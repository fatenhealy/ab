"use strict";
var gestures = require("ui/gestures");
var frame = require("ui/frame");
var observable = require("data/observable");
var rndApi = require("./officeRnD/officeRnDApi");
function pageNavigatingTo(args) {
    var page = args.object;
    var roomInfo;
    if (page && page.navigationContext) {
        roomInfo = page.navigationContext.roomInfo;
    }
    var vm = new observable.Observable();
    if (roomInfo) {
        vm.set("name", roomInfo.name);
        vm.set("isLoading", true);
        rndApi.getRoomImage(roomInfo, function (imageSource) {
            vm.set("image", imageSource);
            vm.set("isLoading", false);
        });
    }
    else {
        vm.set("name", "No map ifno");
        vm.set("image", rndApi.defaultNotFoundImageSource);
    }
    page.bindingContext = vm;
}
exports.pageNavigatingTo = pageNavigatingTo;
function backTap(args) {
    frame.topmost().goBack();
}
exports.backTap = backTap;
function backSwipe(args) {
    if (args.direction === gestures.SwipeDirection.right) {
        frame.topmost().goBack();
    }
}
exports.backSwipe = backSwipe;
//# sourceMappingURL=map-page.js.map