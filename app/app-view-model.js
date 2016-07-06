"use strict";
var observable = require("data/observable");
var dialogs = require("ui/dialogs");
var localSettings = require("application-settings");
var platform = require("platform");
var appModule = require("application");
var types = require("utils/types");
var LOADING_ERROR = "Could not load sessions. Check your Internet connection and try again.";
var everlive = require("./everlive/everlive");
var conferenceDays = [
    { title: "CONFERENCE DAY 1", date: new Date(2016, 7, 12) },
    { title: "CONFERENCE DAY 2 & WORKSHOP", date: new Date(2016, 7, 13) }
];
var sessions = new Array();
var REMIDER_MINUTES = 5;
var FAVOURITES = "FAVOURITES";
var favourites;
try {
    favourites = JSON.parse(localSettings.getString(FAVOURITES, "[]"));
}
catch (error) {
    console.log("Error while retrieveing favourites: " + error);
    favourites = new Array();
    updateFavourites();
}
function findSessionIndexInFavourites(sessionId) {
    for (var i = 0; i < favourites.length; i++) {
        if (favourites[i].sessionId === sessionId) {
            return i;
        }
    }
    return -1;
}
function addToFavourites(session) {
    if (findSessionIndexInFavourites(session.Id) >= 0) {
        // Sesson already added to favourites.
        return;
    }
    try {
        if (platform.device.os === platform.platformNames.android) {
            var projection = java.lang.reflect.Array.newInstance(java.lang.String.class, 1);
            projection[0] = "_id";
            var calendars = android.net.Uri.parse("content://com.android.calendar/calendars");
            var contentResolver = appModule.android.foregroundActivity.getApplicationContext().getContentResolver();
            var managedCursor = contentResolver.query(calendars, projection, null, null, null);
            var calID;
            if (managedCursor.moveToFirst()) {
                var idCol = managedCursor.getColumnIndex(projection[0]);
                calID = managedCursor.getString(idCol);
                managedCursor.close();
            }
            if (types.isUndefined(calID)) {
                // No caledndar to add to
                return;
            }
            var timeZone = java.util.TimeZone.getTimeZone("GMT-05:00");
            var startDate = session.start.getTime();
            var endDate = session.end.getTime();
            var values = new android.content.ContentValues();
            values.put("calendar_id", calID);
            values.put("eventTimezone", timeZone.getID());
            values.put("dtstart", java.lang.Long.valueOf(startDate));
            values.put("dtend", java.lang.Long.valueOf(endDate));
            values.put("title", session.title);
            values.put("eventLocation", session.room);
            var uri = contentResolver.insert(android.provider.CalendarContract.Events.CONTENT_URI, values);
            var eventId = uri.getLastPathSegment();
            session.calendarEventId = eventId;
            var reminderValues = new android.content.ContentValues();
            reminderValues.put("event_id", java.lang.Long.valueOf(java.lang.Long.parseLong(eventId)));
            reminderValues.put("method", java.lang.Long.valueOf(1)); // METHOD_ALERT
            reminderValues.put("minutes", java.lang.Long.valueOf(REMIDER_MINUTES));
            contentResolver.insert(android.provider.CalendarContract.Reminders.CONTENT_URI, reminderValues);
            persistSessionToFavourites(session);
        }
        else if (platform.device.os === platform.platformNames.ios) {
            var store = EKEventStore.new();
            store.requestAccessToEntityTypeCompletion(EKEntityTypeEvent, function (granted, error) {
                if (!granted) {
                    return;
                }
                var event = EKEvent.eventWithEventStore(store);
                event.title = session.title;
                event.timeZone = NSTimeZone.alloc().initWithName("UTC-05:00");
                event.startDate = NSDate.dateWithTimeIntervalSince1970(session.start.getTime() / 1000);
                event.endDate = NSDate.dateWithTimeIntervalSince1970(session.end.getTime() / 1000);
                event.calendar = store.defaultCalendarForNewEvents;
                event.location = session.room;
                event.addAlarm(EKAlarm.alarmWithRelativeOffset(-REMIDER_MINUTES * 60));
                var err;
                var result = store.saveEventSpanCommitError(event, EKSpan.EKSpanThisEvent, true);
                session.calendarEventId = event.eventIdentifier;
                persistSessionToFavourites(session);
            });
        }
    }
    catch (error) {
        console.log("Error while creating calendar event: " + error);
    }
}
function persistSessionToFavourites(session) {
    favourites.push({
        sessionId: session.Id,
        calendarEventId: session.calendarEventId
    });
    updateFavourites();
}
function removeFromFavourites(session) {
    var index = findSessionIndexInFavourites(session.Id);
    if (index >= 0) {
        favourites.splice(index, 1);
        updateFavourites();
    }
    if (session.calendarEventId) {
        if (platform.device.os === platform.platformNames.android) {
            var deleteUri = android.content.ContentUris.withAppendedId(android.provider.CalendarContract.Events.CONTENT_URI, parseInt(session.calendarEventId));
            appModule.android.foregroundActivity.getApplicationContext().getContentResolver().delete(deleteUri, null, null);
        }
        else if (platform.device.os === platform.platformNames.ios) {
            var store = EKEventStore.new();
            store.requestAccessToEntityTypeCompletion(EKEntityTypeEvent, function (granted, error) {
                if (!granted) {
                    return;
                }
                var eventToRemove = store.eventWithIdentifier(session.calendarEventId);
                if (eventToRemove) {
                    store.removeEventSpanCommitError(eventToRemove, EKSpan.EKSpanThisEvent, true);
                    session.calendarEventId = undefined;
                }
            });
        }
    }
}
function updateFavourites() {
    var newValue = JSON.stringify(favourites);
    console.log("favourites: " + newValue);
    localSettings.setString(FAVOURITES, newValue);
}
var el = new everlive({
    apiKey: '9qp2g3vrzo4gm6b7',
    scheme: 'https',
    offlineStorage: true
});
var expandExp = {
    "speakers": true,
    "roomInfo": true
};
function pushSessions(sessionsFromEvelive) {
    for (var i = 0; i < sessionsFromEvelive.length; i++) {
        var newSession = new SessionModel(sessionsFromEvelive[i]);
        var indexInFavs = findSessionIndexInFavourites(newSession.Id);
        if (indexInFavs >= 0) {
            newSession.favorite = true;
            newSession.calendarEventId = favourites[indexInFavs].calendarEventId;
        }
        sessions.push(newSession);
    }
}
function loadFirstChunk() {
    var query = new everlive.Query();
    query.order("start").take(50).expand(expandExp);
    query.order('CreatedAt');
    query.orderDesc("ModifiedAt");
    el.data('Sessions').get(query).then(function (data) {
        pushSessions(data.result);
        loadSecondChunk();
    }, function (error) {
        dialogs.alert(LOADING_ERROR);
    });
}
function loadSecondChunk() {
    var query = new everlive.Query();
    query.order("start").skip(50).take(50).expand(expandExp);
    query.order('CreatedAt');
    query.orderDesc("ModifiedAt");
    el.data('Sessions').get(query).then(function (data) {
        pushSessions(data.result);
        exports.appModel.onDataLoaded();
    }, function (error) {
        dialogs.alert(LOADING_ERROR);
    });
}
loadFirstChunk();
var AppViewModel = (function (_super) {
    __extends(AppViewModel, _super);
    function AppViewModel() {
        _super.call(this);
        this._search = "";
        this.selectedIndex = 0;
        this.selectedViewIndex = 1;
        this.set("actionBarTitle", "All sessions");
        this.set("isLoading", true);
        this.set("isSessionsPage", true);
    }
    Object.defineProperty(AppViewModel.prototype, "sessions", {
        get: function () {
            return this._sessions;
        },
        enumerable: true,
        configurable: true
    });
    Object.defineProperty(AppViewModel.prototype, "favorites", {
        get: function () {
            return this.sessions.filter(function (i) { return i.favorite; });
        },
        enumerable: true,
        configurable: true
    });
    Object.defineProperty(AppViewModel.prototype, "search", {
        get: function () {
            return this._search;
        },
        set: function (value) {
            if (this._search !== value) {
                this._search = value;
                this.notify({ object: this, eventName: observable.Observable.propertyChangeEvent, propertyName: "search", value: value });
                this.filter();
            }
        },
        enumerable: true,
        configurable: true
    });
    Object.defineProperty(AppViewModel.prototype, "selectedIndex", {
        get: function () {
            return this._selectedIndex;
        },
        set: function (value) {
            if (this._selectedIndex !== value) {
                this._selectedIndex = value;
                this.notify({ object: this, eventName: observable.Observable.propertyChangeEvent, propertyName: "selectedIndex", value: value });
                this.set("dayHeader", conferenceDays[value].title);
                if (this.search !== "") {
                    this.search = "";
                }
                else {
                    this.filter();
                }
            }
        },
        enumerable: true,
        configurable: true
    });
    AppViewModel.prototype.filter = function () {
        var _this = this;
        this._sessions = sessions.filter(function (s) {
            return s.start.getDate() === conferenceDays[_this.selectedIndex].date.getDate()
                && s.title.toLocaleLowerCase().indexOf(_this.search.toLocaleLowerCase()) >= 0;
        });
        if (this.selectedViewIndex === 0) {
            this._sessions = this._sessions.filter(function (i) { return i.favorite || i.isBreak; });
        }
        this.notify({ object: this, eventName: observable.Observable.propertyChangeEvent, propertyName: "sessions", value: this._sessions });
    };
    AppViewModel.prototype.onDataLoaded = function () {
        this.set("isLoading", false);
        this.filter();
    };
    AppViewModel.prototype.selectView = function (index, titleText) {
        this.selectedViewIndex = index;
        if (this.selectedViewIndex < 2) {
            this.filter();
        }
        this.notify({ object: this, eventName: observable.Observable.propertyChangeEvent, propertyName: "selectedViewIndex", value: this.selectedViewIndex });
        this.set("actionBarTitle", titleText);
        this.set("isSessionsPage", this.selectedViewIndex < 2);
    };
    return AppViewModel;
}(observable.Observable));
exports.AppViewModel = AppViewModel;
var SessionModel = (function (_super) {
    __extends(SessionModel, _super);
    function SessionModel(source) {
        _super.call(this);
        if (source) {
            this._id = source.Id;
            this._title = source.title;
            this._room = source.room;
            this._roomInfo = source.roomInfo;
            this._start = this.fixDate(source.start);
            this._end = this.fixDate(source.end);
            this._speakers = source.speakers;
            this._description = source.description;
            this._isBreak = source.isBreak;
        }
    }
    SessionModel.prototype.fixDate = function (date) {
        return new Date(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), date.getUTCHours(), date.getUTCMinutes(), date.getUTCSeconds());
    };
    Object.defineProperty(SessionModel.prototype, "Id", {
        get: function () {
            return this._id;
        },
        enumerable: true,
        configurable: true
    });
    Object.defineProperty(SessionModel.prototype, "title", {
        get: function () {
            return this._title;
        },
        enumerable: true,
        configurable: true
    });
    Object.defineProperty(SessionModel.prototype, "room", {
        get: function () {
            if (this._room) {
                return this._room;
            }
            if (this._roomInfo) {
                return this._roomInfo.name;
            }
            return null;
        },
        enumerable: true,
        configurable: true
    });
    Object.defineProperty(SessionModel.prototype, "roomInfo", {
        get: function () {
            return this._roomInfo;
        },
        enumerable: true,
        configurable: true
    });
    Object.defineProperty(SessionModel.prototype, "start", {
        get: function () {
            return this._start;
        },
        enumerable: true,
        configurable: true
    });
    Object.defineProperty(SessionModel.prototype, "end", {
        get: function () {
            return this._end;
        },
        enumerable: true,
        configurable: true
    });
    Object.defineProperty(SessionModel.prototype, "speakers", {
        get: function () {
            return this._speakers;
        },
        enumerable: true,
        configurable: true
    });
    Object.defineProperty(SessionModel.prototype, "range", {
        get: function () {
            var startMinutes = this.start.getMinutes() + "";
            var endMinutes = this.end.getMinutes() + "";
            var startAM = this.start.getHours() < 12 ? "am" : "pm";
            var endAM = this.end.getHours() < 12 ? "am" : "pm";
            var startHours = (this.start.getHours() <= 12 ? this.start.getHours() : this.start.getHours() - 12) + "";
            var endHours = (this.end.getHours() <= 12 ? this.end.getHours() : this.end.getHours() - 12) + "";
            return (startHours.length === 1 ? '0' + startHours : startHours) + ':' + (startMinutes.length === 1 ? '0' + startMinutes : startMinutes) + startAM +
                ' - ' + (endHours.length === 1 ? '0' + endHours : endHours) + ':' + (endMinutes.length === 1 ? '0' + endMinutes : endMinutes) + endAM;
        },
        enumerable: true,
        configurable: true
    });
    Object.defineProperty(SessionModel.prototype, "isBreak", {
        get: function () {
            return this._isBreak;
        },
        enumerable: true,
        configurable: true
    });
    Object.defineProperty(SessionModel.prototype, "favorite", {
        get: function () {
            return this._favorite;
        },
        set: function (value) {
            if (this._favorite !== value && !this._isBreak) {
                this._favorite = value;
                this.notify({ object: this, eventName: observable.Observable.propertyChangeEvent, propertyName: "favorite", value: this._favorite });
            }
        },
        enumerable: true,
        configurable: true
    });
    Object.defineProperty(SessionModel.prototype, "description", {
        get: function () {
            return this._description;
        },
        enumerable: true,
        configurable: true
    });
    Object.defineProperty(SessionModel.prototype, "descriptionShort", {
        get: function () {
            if (this.description.length > 160) {
                return this.description.substr(0, 160) + "...";
            }
            else {
                return this.description;
            }
        },
        enumerable: true,
        configurable: true
    });
    SessionModel.prototype.toggleFavorite = function () {
        this.favorite = !this.favorite;
        if (this.favorite) {
            addToFavourites(this);
        }
        else {
            removeFromFavourites(this);
        }
    };
    Object.defineProperty(SessionModel.prototype, "calendarEventId", {
        get: function () {
            return this._calendarEventId;
        },
        set: function (value) {
            if (this._calendarEventId !== value) {
                this._calendarEventId = value;
                this.notify({ object: this, eventName: observable.Observable.propertyChangeEvent, propertyName: "calendarEventId", value: this._calendarEventId });
            }
        },
        enumerable: true,
        configurable: true
    });
    return SessionModel;
}(observable.Observable));
exports.SessionModel = SessionModel;
exports.appModel = new AppViewModel();
// load other info
el.data('Info').get().then(function (data) {
    for (var i = 0; i < data.result.length; i++) {
        var item = data.result[i];
        exports.appModel.set("info_" + item.key, item.value);
    }
}, function (error) {
    console.log("Could not load Info. Error: " + error);
    dialogs.alert(LOADING_ERROR);
});
//# sourceMappingURL=app-view-model.js.map