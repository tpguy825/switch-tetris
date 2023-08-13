"use strict";
//Inspiration for Fullscreen-mode by https://davidwalsh.name/fullscreen
var inFullScreen = false;
function toggleFullScreen(element) {
    if (inFullScreen) {
        launchFullscreen(element);
        inFullScreen = false;
    }
    else {
        exitFullscreen();
        inFullScreen = true;
    }
}
function launchFullscreen(element) {
    if (element.requestFullscreen) {
        element.requestFullscreen();
        // @ts-expect-error - mozRequestFullScreen is platform specific
    }
    else if (element.mozRequestFullScreen) {
        // @ts-expect-error - mozRequestFullScreen is platform specific
        element.mozRequestFullScreen();
        // @ts-expect-error - webkitRequestFullScreen is platform specific
    }
    else if (element.webkitRequestFullscreen) {
        // @ts-expect-error - webkitRequestFullScreen is platform specific
        element.webkitRequestFullscreen();
        // @ts-expect-error - msRequestFullScreen is platform specific
    }
    else if (element.msRequestFullscreen) {
        // @ts-expect-error - msRequestFullScreen is platform specific
        element.msRequestFullscreen();
    }
}
function exitFullscreen() {
    if (document.exitFullscreen) {
        document.exitFullscreen();
        // @ts-expect-error - mozCancelFullScreen is platform specific
    }
    else if (document.mozCancelFullScreen) {
        // @ts-expect-error - mozCancelFullScreen is platform specific
        document.mozCancelFullScreen();
        // @ts-expect-error - webkitExitFullscreen is platform specific
    }
    else if (document.webkitExitFullscreen) {
        // @ts-expect-error - webkitExitFullscreen is platform specific
        document.webkitExitFullscreen();
    }
}
