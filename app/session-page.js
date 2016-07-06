"use strict";
var gestures = require("ui/gestures");
var platform = require("platform");
var utils = require("utils/utils");
var frame = require("ui/frame");
var view = require("ui/core/view");
function pageNavigatingTo(args) {
    var page = args.object;
    page.bindingContext = page.navigationContext;
    disableScroll(page.getViewById("sepakers-list"));
}
exports.pageNavigatingTo = pageNavigatingTo;
function disableScroll(listView) {
    if (listView.android) {
        listView.android.setSelector(new android.graphics.drawable.ColorDrawable(0));
        listView.android.setOnTouchListener(new android.view.View.OnTouchListener({
            onTouch: function (view, motionEvent) {
                return (motionEvent.getAction() === android.view.MotionEvent.ACTION_MOVE);
            }
        }));
    }
    if (listView.ios) {
        listView.ios.scrollEnabled = false;
        listView.ios.allowsSelection = false;
    }
}
function toggleFavorite(args) {
    var item = args.view.bindingContext;
    item.toggleFavorite();
}
exports.toggleFavorite = toggleFavorite;
function shareTap(args) {
    var item = args.view.bindingContext;
    var shareText = item.title + " ";
    if (item.speakers) {
        var speakerNames = "";
        var byStr = item.speakers.forEach(function (sp, i, arr) {
            if (sp.twitterName) {
                speakerNames += "@" + sp.twitterName + " ";
            }
            if (sp.bio) {
                speakerNames += " " + sp.bio + " ";
            }
        });
        if (speakerNames) {
            shareText += "by " + speakerNames;
        }
    }
    shareText += " #APJExchange";
    if (platform.device.os === platform.platformNames.android) {
        var intent = new android.content.Intent(android.content.Intent.ACTION_SEND);
        intent.setType("text/plain");
        intent.putExtra(android.content.Intent.EXTRA_SUBJECT, "subject");
        intent.putExtra(android.content.Intent.EXTRA_TEXT, shareText);
        var activity = frame.topmost().android.activity;
        activity.startActivity(android.content.Intent.createChooser(intent, "share"));
    }
    else if (platform.device.os === platform.platformNames.ios) {
        var currentPage = frame.topmost().currentPage;
        var controller = new UIActivityViewController(utils.ios.collections.jsArrayToNSArray([shareText]), null);
        currentPage.ios.presentViewControllerAnimatedCompletion(controller, true, null);
    }
}
exports.shareTap = shareTap;
function toogleDescritpion(args) {
    var btn = args.object;
    var page = view.getAncestor(btn, "Page");
    var txtDesc = page.getViewById("txtDescription");
    var scroll = page.getViewById("scroll");
    var item = page.bindingContext;
    if (btn.text === "MORE") {
        btn.text = "LESS";
        txtDesc.text = item.description;
    }
    else {
        btn.text = "MORE";
        txtDesc.text = item.descriptionShort;
        scroll.scrollToVerticalOffset(0, false);
    }
}
exports.toogleDescritpion = toogleDescritpion;
function backTap(args) {
    frame.topmost().goBack();
}
exports.backTap = backTap;
function showMapTap(args) {
    var session = args.view.bindingContext;
    frame.topmost().navigate({
        moduleName: "map-page",
        context: session
    });
}
exports.showMapTap = showMapTap;
function backSwipe(args) {
    if (args.direction === gestures.SwipeDirection.right) {
        frame.topmost().goBack();
    }
}
exports.backSwipe = backSwipe;
function openTwitter(args) {
    var url = args.view.tag;
    if (url) {
        url = "http://twitter.com/" + url;
        if (platform.device.os === platform.platformNames.ios) {
            var nsUrl = NSURL.URLWithString(url);
            var sharedApp = UIApplication.sharedApplication();
            if (sharedApp.canOpenURL(nsUrl)) {
                sharedApp.openURL(nsUrl);
            }
        }
        else if (platform.device.os === platform.platformNames.android) {
            var intent = new android.content.Intent(android.content.Intent.ACTION_VIEW, android.net.Uri.parse(url));
            var activity = frame.topmost().android.activity;
            activity.startActivity(android.content.Intent.createChooser(intent, "Open"));
        }
    }
}
exports.openTwitter = openTwitter;
//# sourceMappingURL=session-page.js.map