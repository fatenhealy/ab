"use strict";
var frame = require("ui/frame");
var view = require("ui/core/view");
var platform = require("platform");
var appViewModel = require("./app-view-model");
function pageLoaded(args) {
    var page = args.object;
    // Enable platform specific feature (in this case Android page caching)
    if (frame.topmost().android) {
        frame.topmost().android.cachePagesOnNavigate = true;
    }
    hideSearchKeyboard(page);
    var iosFrame = frame.topmost().ios;
    if (iosFrame) {
        // Fix status bar color and nav bar vidibility
        iosFrame.controller.view.window.backgroundColor = UIColor.blackColor();
        iosFrame.navBarVisibility = "never";
    }
    page.bindingContext = appViewModel.appModel;
}
exports.pageLoaded = pageLoaded;
function selectSession(args) {
    var session = args.view.bindingContext;
    var page = view.getAncestor(args.object, "Page");
    hideSearchKeyboard(page);
    if (!session.isBreak) {
        frame.topmost().navigate({
            moduleName: "session-page",
            context: session
        });
    }
}
exports.selectSession = selectSession;
function selectView(args) {
    var btn = args.object;
    var page = view.getAncestor(btn, "Page");
    var slideBar = page.getViewById("SideDrawer");
    slideBar.closeDrawer();
    appViewModel.appModel.selectView(parseInt(btn.tag), btn.text);
    hideSearchKeyboard(page);
}
exports.selectView = selectView;
function toggleFavorite(args) {
    var session = args.view.bindingContext;
    session.toggleFavorite();
}
exports.toggleFavorite = toggleFavorite;
function showSlideout(args) {
    console.log("show slideout");
    var page = view.getAncestor(args.view, "Page");
    var slideBar = page.getViewById("SideDrawer");
    slideBar.showDrawer();
    hideSearchKeyboard(page);
}
exports.showSlideout = showSlideout;
function hideSearchKeyboard(page) {
    var searchBar = page.getViewById("search");
    if (searchBar.android) {
        searchBar.android.clearFocus();
    }
    if (searchBar.ios) {
        searchBar.ios.resignFirstResponder();
    }
}
function goToUrl(args) {
    var url = args.view.tag;
    if (url) {
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
            activity.startActivity(android.content.Intent.createChooser(intent, "share"));
        }
    }
}
exports.goToUrl = goToUrl;
//# sourceMappingURL=main-page.js.map