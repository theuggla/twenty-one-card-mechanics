(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
/**
 * Starting point fpr the application.
 * The application would work better when used with HTTP2
 * due to the fact that it makes use of web-components,
 * but it's been built with browserify to work as a
 * normal HTTP1 application in lieu of this.
 * @author Molly Arhammar
 * @version 1.0
 */


//to make web components work with browserify
let window = require('./draggable-window.js');
let menu = require("./expandable-menu-item.js");
let memoryGame = require('./memory-game.js');
let memoryApp = require('./memory-app.js');
let instaChat= require('./insta-chat.js');
let instaChatApp = require('./insta-chat-app.js');
let imageGallery = require('./image-gallery.js');
let imageGalleryApp = require('./image-gallery-app.js');

//requires
let Desktop = require("./desktop.js");

//nodes
let mainMenu = document.querySelector("#windowSelector");
let subMenuTemplate = document.querySelector("#subMenu");
let windowSpace = document.querySelector("#openWindows");

//variables
let myDesktop;
let windowManager = Desktop.windowManager(windowSpace);


//set up event handler for sub-menu
let eventHandlerSubMenu = function (event) {
    let type = event.target.getAttribute('data-kind') || event.target.parentNode.getAttribute('data-kind');

    switch (event.target.getAttribute('data-task')) {
        case 'open':
            windowManager.createWindow(type).focus();
            break;
        case 'close':
            windowManager.close(type);
            break;
        case 'minimize':
            windowManager.minimize(type);
            break;
        case 'expand':
            windowManager.expand(type);
            break;
        default:
            break;
    }
    if (event.type === 'click') {
        event.preventDefault();
    }
};

let desktopConfig = {
    space: windowSpace,
    menu: mainMenu,
    windowManager: windowManager,
    subTemplate: subMenuTemplate,
    subHandler: eventHandlerSubMenu
};


//initiate desktop
myDesktop = new Desktop(desktopConfig);

//initiate serviceworker
navigator.serviceWorker.register('./sw-build.js', {
    scope: '/'
});

},{"./desktop.js":2,"./draggable-window.js":3,"./expandable-menu-item.js":4,"./image-gallery-app.js":5,"./image-gallery.js":6,"./insta-chat-app.js":7,"./insta-chat.js":8,"./memory-app.js":9,"./memory-game.js":10}],2:[function(require,module,exports){
/**
 * A module for a class desktop.
 * Initiates a web desktop with a menu
 * and windows to open.
 *
 * @author Molly Arhammar
 * @version 1.0
 */


class Desktop {
    /**
     * Initiates the Desktop. Sets up event listeners
     * and adds sub-menu to the main menu items if such are provided.
     * @param desktopConfig {object} with params:
     * menu {[expandable-menu-item]},
     * space: {node} where the desktop windows lives
     * and optional:
     * windowManager: {object} a custom window manager that handles the windows, will otherwise be supplied
     * subTemplate: {document-fragment} a sub-menu to be added to each of the main menu items
     * subHandler {function} an event handler to be applies to the sub menu
     */
    constructor(desktopConfig) {
        let topWindow = 2; //to keep focused window on top

        let mainMenu = desktopConfig.menu;
        let windowSpace = desktopConfig.space;
        let windowManager = desktopConfig.windowManager || Desktop.windowManager(windowSpace); //supply windowManager if there is none
        let subMenuTemplate = desktopConfig.subTemplate;
        let subHandler = desktopConfig.subHandler;


        if (subMenuTemplate) { //there is a submenu
            //add the submenu
            Array.prototype.forEach.call(mainMenu.children, (node) => {
                let subMenu = document.importNode(subMenuTemplate.content, true);
                this.addSubMenu(node, subMenu, subHandler);
            });

            //add event handlers on the sub menu
            addEventListeners(mainMenu, 'click focusout', (event) => {
                let mainMenuItems = mainMenu.querySelectorAll('expandable-menu-item');
                mainMenuItems.forEach((item) => {
                    if ((item !== event.target && item !== event.target.parentElement) && (item.displayingSubMenu)) {
                        item.toggleSubMenu(false);
                    }
                })
            });
        }

        //open new window at double click
        mainMenu.addEventListener('dblclick', (event) => {
            let type = event.target.getAttribute("data-kind") || event.target.parentNode.getAttribute("data-kind");
            if (type) {
                windowManager.createWindow(type).focus();
            }
            event.preventDefault();
        });

        //put focused window on top
        windowSpace.addEventListener('focus', (event) => {
            if (event.target !== windowSpace) {
                event.target.style.zIndex = topWindow;
                topWindow += 1;
            }
        }, true);
    }

    /**
     * @param item {HTMLElement} the expandable-menu-item to add the sub-menu to
     * @param subMenu {HTMLElement} a template of the sub-menu
     * @param eventHandler {function} the event handler to be applied to the sub menu
     */
    addSubMenu(item, subMenu, eventHandler) {
        let label = item.getAttribute('label');

        Array.prototype.forEach.call(subMenu.children, (node) => {
            node.setAttribute('label', label);
        });

        item.appendChild(subMenu);

        item.addEventListener('click', eventHandler);
    }

    /**
     * creates a window manager to handle windows on the desktop.
     * @param windowSpace {HTMLElement} the space where the windows live
     * @returns {{createWindow: createWindow, openWindows: openWindows, expand: expand, minimize: minimize, close: close}} an
     * object with methods to expand, minimize, close all, open new, and get open windows of a certain type.
     */
    static windowManager(windowSpace) {
        //keep track of the window space
        let wm = {
            startX: windowSpace.offsetLeft + 20,
            startY: windowSpace.offsetTop + 20,
            types: 0
        };

        return {
            /**
             * Creates a new window and opens it in the window space.
             * @param type {string} the name of the html-element to create.
             * @returns {HTMLElement} the newly created window
             */
            createWindow: function (type) {
                let aWindow;
                //because of a fight I have with browserify these do not load dynamically here, but if you look at
                //theuggla.github.io/desktop/source they do :-)
                /*if (!wm[type]) {
                    let linkTemplate = document.querySelector("#linkTemplate");
                    let link = document.importNode(linkTemplate.content.firstElementChild, true);
                    link.href = "/" + type + ".html";
                    document.head.appendChild(link);
                }*/

                aWindow = document.createElement(type);

                //import pictures for the image gallery
                if (type === 'image-gallery-app') {
                    if (document.querySelector('#pictures')) {
                        aWindow.appendChild(document.importNode(document.querySelector('#pictures').content, true));
                    }
                }

                windowSpace.appendChild(aWindow);
                setupSpace(type, aWindow);

                //keep track of the open windows
                if (wm[type].open) {
                    wm[type].open.push(aWindow);
                } else {
                    wm[type].open = [aWindow];
                }

                return aWindow;
            },
            /**
             * Gets the open windows of a type.
             * @param type {string} the name of the html-element to check for.
             * @returns {[HTMLElement]} a node list of the open windows of the type.
             */
            openWindows: function (type) {
                if (wm[type]) {
                    let result = [];
                    let windows = wm[type].open;
                    //filter out the one's that's been closed since the last time
                    result = windows.filter((w) => {
                        return w.open;
                    });
                    wm[type].open = result;
                    return result;
                } else {
                    return 0; //if no windows are open
                }
            },
            /**
             * Expands all minimized windows of a type.
             * @param type {string} the name of the html-element to expand.
             */
            expand: function (type) {
                let wins = this.openWindows(type);
                if (wins) {
                    wins.forEach((w) => {
                        w.minimized = false;
                    });
                }
            },
            /**
             * Minimizes all open windows of a type.
             * @param type {string} the name of the html-element to minimize.
             */
            minimize: function (type) {
                let wins = this.openWindows(type);
                if (wins) {
                    wins.forEach((w) => {
                        w.minimized = true;
                    });
                }
            },
            /**
             * Closes all open windows of a type.
             * @param type {string} the name of the html-element to close.
             */
            close: function (type) {
                let wins = this.openWindows(type);
                if (wins) {
                    console.log(wins);
                    wins.forEach((w) => {
                        w.close();
                    });
                }
            }
        };

        //helper functions
        // keeps track of the window space so the windows don't all
        //open on top of each other, and doesn't disappear out
        //of the space
        function setupSpace(type, space) {
            let destination = {};
            let x;
            let y;

            if (wm[type]) { //the type already exists
                destination.x = (wm[type].latestCoords.x += 50);  //create a new space to open the window
                destination.y = (wm[type].latestCoords.y += 50);

                if (!(withinBounds(space, windowSpace, destination))) { //check that the space is within bounds
                    x = wm[type].startCoords.x += 5;
                    y = wm[type].startCoords.y += 5;
                    wm[type].latestCoords.x = x;
                    wm[type].latestCoords.y = y;
                } else {
                    x = destination.x;
                    y = destination.y;
                }

            } else { //create a starting point for the windows of this type
                destination.x = (wm.startX + (60 * wm.types));
                destination.y = (wm.startY);

                if (!(withinBounds(space, windowSpace, destination))) {
                    x = wm.startX;
                    y = wm.startY;
                } else {
                    x = destination.x;
                    y = destination.y;
                }

                wm[type] = {};
                wm[type].startCoords = {
                    x: x,
                    y: y
                };
                wm[type].latestCoords = {
                    x: x,
                    y: y
                };
                wm.types += 1;
            }
            space.tabIndex = 0;
            space.style.top = y + "px";
            space.style.left = x + "px";
        }

        //checks if a space is within bounds
        function withinBounds(element, container, coords) {
            let minX = container.offsetLeft;
            let maxX = (minX + container.clientWidth) - (element.getBoundingClientRect().width);
            let minY = container.offsetTop;
            let maxY = (minY + container.clientHeight) - (element.getBoundingClientRect().height);

            return (coords.x <= maxX && coords.x >= minX && coords.y <= maxY && coords.y >= minY);
        }
    }
}


//helper function to add more than one event type for each element and handler
function addEventListeners (element, events, handler) {
    events.split(' ').forEach(event => element.addEventListener(event, handler));
}

//export
module.exports = Desktop;

},{}],3:[function(require,module,exports){
/*
* A module for a custom HTML element draggable-window to form part of a web component.
* It creates a window that can be moved across the screen, closed and minimized.
* @author Molly Arhammar
* @version 1.0.0
*
*/

class DraggableWindow extends HTMLElement {
    /**
     * Initiates a draggable-window, sets up shadow DOM.
     */
    constructor() {
        super();
        let windowTemplate = document.querySelector('link[href="/draggable-window.html"]').import.querySelector("#windowTemplate"); //shadow DOM import

        //setup shadow dom styles
        let shadowRoot = this.attachShadow({mode: "open", delegatesFocus: true});
        let instance = windowTemplate.content.cloneNode(true);
        shadowRoot.appendChild(instance);
    }

    /**
     * Runs when window is inserted into the DOM.
     * Sets up event listeners and behaviour of the window.
     */
    connectedCallback() {

        //set behaviour
        makeDraggable(this, this.parentNode);

        //add event listeners
        this.addEventListener("click", (event) => {
            let target = event.composedPath()[0]; //follow the trail through shadow DOM
            let id = target.getAttribute("id");
            if (id === "close") {
                this.close();
            } else if (id === "minimize") {
                this.minimized = true;
            }
            if (event.type === 'click') { //make work with touch events
                event.preventDefault();
            }
        });

        this.open = true;
    }

    /**
     * Sets up what attribute-changes to watch for in the DOM.
     * @returns {[string]} an array of the names of the attributes to watch.
     */
    static get observedAttributes() {
        return ['open'];
    }

    /**
     * Watches for attribute changes in the DOM according to observedAttributes()
     * @param name the name of the attribute
     * @param oldValue the old value
     * @param newValue the new value
     */
    attributeChangedCallback(name, oldValue, newValue) {
        if (!this.open) {
            this.close();
        }
    }

    /**
     * @returns {boolean} true if the window has attribute 'open'
     */
    get open() {
        return this.hasAttribute('open');
    }

    /**
     * Sets the 'open' attribute on the window.
     * @param open {boolean} whether to add or remove the 'open' attribute
     */
    set open(open) {
        if (open) {
            this.setAttribute('open', '');
        } else {
            this.removeAttribute('open');
        }
    }

    /**
     * @returns {boolean} true if the window has attribute 'minimized'
     */
    get minimized() {
        return this.hasAttribute('minimized');
    }

    /**
     * Sets the 'minimized' attribute on the window.
     * @param minimize {boolean} whether to add or remove the 'minimized' attribute
     */
    set minimized(minimize) {
        if (minimize) {
            this.setAttribute('minimized', '');
        } else {
            this.removeAttribute('minimized');
        }
    }

    /**
     * Closes the window. Removes it from the DOM and sets all attributes to false.
     */
    close() {
        if (this.open) {
            this.open = false;
            this.minimized = false;
            if (this.parentElement) {
                this.parentNode.removeChild(this);
            } else if (this.parentNode.host && this.parentNode.host.parentNode) { //this is part of a shadow dom
                this.parentNode.host.parentNode.removeChild(this.parentNode.host);
            }
        }
    }

}

//helper function
//makes an element draggable with  mouse, arrows and touch
function makeDraggable(el) {
    let arrowDrag;
    let mouseDrag;
    let dragoffset = { //to make the drag not jump from the corner
        x: 0,
        y: 0
    };

    let events = function() {
        addEventListeners(el, 'focusin mousedown', ((event) => {
            let target = event;
            arrowDrag = true;
            if (event.type === 'mousedown') {
                mouseDrag = true;
                dragoffset.x = target.pageX - el.offsetLeft;
                dragoffset.y = target.pageY - el.offsetTop;
            }
        }));
        addEventListeners(el, 'focusout mouseup', ((event) => {
            if (event.type === 'mouseup') {
                if (mouseDrag) {
                    mouseDrag = false;
                }
            } else {
                arrowDrag = false;
            }
        }));
        addEventListeners(document, 'mousemove keydown', ((event) => {
            let destination = {}; //as to not keep polling the DOM

            if (mouseDrag) {
                destination.y = (event.pageY - dragoffset.y);
                destination.x = (event.pageX - dragoffset.x);
            } else if (arrowDrag) {
                destination.y = parseInt(el.style.top.slice(0, -2));
                destination.x = parseInt(el.style.left.slice(0, -2));

                switch (event.key) {
                    case 'ArrowUp':
                        destination.y -= 5;
                        break;
                    case 'ArrowDown':
                        destination.y += 5;
                        break;
                    case 'ArrowLeft':
                        destination.x -= 5;
                        break;
                    case 'ArrowRight':
                        destination.x += 5;
                        break;
                }
            }

            if (mouseDrag || arrowDrag) {
                el.style.left = destination.x  + "px";
                el.style.top = destination.y  + "px";
            }

        }));
    };

    //initiate a mouse event from the touch
    function touchHandler(event) {
        if (event.target.assignedSlot && event.target.assignedSlot.name === 'title') { //only drag from the title bar on touch, as to not interrupt scrolling
            let touches = event.changedTouches;
            let first = touches[0];
            let type = "";

            switch (event.type) {
                case "touchstart":
                    type = "mousedown";
                    break;
                case "touchmove":
                    type = "mousemove";
                    break;
                case "touchend":
                    type = "mouseup";
                    break;
                default:
                    return;
            }

            //set up the event
            let simulatedEvent = new MouseEvent(type, {
                screenX: first.screenX,
                screenY: first.screenY,
                clientX: first.clientX,
                clientY: first.clientY,
                button: 1,
                bubbles: true

            });

            el.dispatchEvent(simulatedEvent);
        }
    }

    function touchevents() {
        el.addEventListener("touchstart", touchHandler, true);
        document.addEventListener("touchmove", touchHandler, true);
        el.addEventListener("touchend", touchHandler, true);
        document.addEventListener("touchcancel", touchHandler, true);
    }

    events();
    touchevents();
}

//helper function
//adds multiple event listeners with identical handlers
function addEventListeners(element, events, handler) {
    events.split(' ').forEach(event => element.addEventListener(event, handler));
}

//defines the element
customElements.define('draggable-window', DraggableWindow);

},{}],4:[function(require,module,exports){
/*
 * A module for a custom HTML element expandable-menu-item form part of a web component.
 * It creates an item that when clicked toggles to show or hide sub-items.
 * @author Molly Arhammar
 * @version 1.0.0
 *
 */

class ExpandableMenuItem extends HTMLElement {
    /**
     * Initiates a draggable-window, sets up shadow DOM.
     */
    constructor() {
        super();
        let menuTemplate = document.querySelector('link[href="/expandable-menu-item.html"]').import.querySelector("#menuItemTemplate"); //shadow DOM import

        //set up shadow dom styles
        let shadowRoot = this.attachShadow({mode: "open"});
        let instance = menuTemplate.content.cloneNode(true);
        shadowRoot.appendChild(instance);

    }

    /**
     * Runs when window is inserted into the DOM.
     * Sets up event listeners and behaviour of the item.
     */
    connectedCallback() {
        makeExpandable(this);
    }

    /**
     * @returns {[node]} an array of the subitems the item has assigned in the DOM.
     * A subitem counts as an item that has the slot of 'subitem' and the same label
     * as the expandable menu item itself.
     */
    get subMenu() {
        let label = this.getAttribute('label');
        return Array.prototype.filter.call(this.querySelectorAll('[slot="subitem"]'), (node) => {
            let nodeLabel = node.getAttribute('label');
            return nodeLabel === label;
        });
    }

    /**
     * @returns {boolean} true if the item is currently displaying the submenu-items.
     */
    get displayingSubMenu() {
        return !this.subMenu[0].hasAttribute('hide');
    }

    /**
     * Shows or hides the submenu-items.
     * @param show {boolean} whether to show or hide.
     */
    toggleSubMenu(show) {
        if (show) {
            this.subMenu.forEach((post) => {
                post.removeAttribute('hide');
            });
        } else {
            this.subMenu.forEach((post) => {
                post.setAttribute('hide', '');
            });
        }

    }

}

//defines the element
customElements.define('expandable-menu-item', ExpandableMenuItem);

//helper function to make the item expandable
//takes the item to expand as a parameter
function makeExpandable(item) {
    let nextFocus = 0;
    let show = false;
    let arrowExpand;
    let mouseExpand;

    let events = function () {
        addEventListeners(item, 'focusin click', ((event) => {
                arrowExpand = true;
                if (event.type === 'click') {
                    mouseExpand = true;
                    show = !show;
                    item.toggleSubMenu(show);
                    event.preventDefault();
                } else {
                    item.toggleSubMenu(true);
                }

        }));
        addEventListeners(item, 'keydown', ((event) => { //make the sub-items traversable by pressing the arrow keys
                if (arrowExpand) {
                    switch (event.key) {
                        case 'ArrowRight':
                            item.toggleSubMenu(true);
                            break;
                        case 'ArrowLeft':
                            item.toggleSubMenu(false);
                            break;
                        case 'ArrowUp':
                            if (!item.displayingSubMenu) {
                                item.toggleSubMenu(true);
                            }
                            nextFocus -= 1;
                            if (nextFocus < 0 || nextFocus >= item.subMenu.length) {
                                nextFocus = item.subMenu.length -1;
                            }
                            item.subMenu[nextFocus].focus();
                            focus(item, item.subMenu[nextFocus]); //make it accessible via css visual clues even if the active element is hidden within shadowDOM
                            break;
                        case 'ArrowDown':
                            if (!item.displayingSubMenu) {
                                item.toggleSubMenu(true);
                            }
                            nextFocus += 1;
                            if (nextFocus >= item.subMenu.length || nextFocus < 0) {
                                nextFocus = 0;
                            }
                            item.subMenu[nextFocus].focus();
                            focus(item, item.subMenu[nextFocus]); //make it accessible via css visual clues even if the active element is hidden within shadowDOM
                            break;
                    }
                }

        }));
    };

    events();
}

//helper functions

//adds multiple event listeners with identical handlers
function addEventListeners(element, events, handler) {
    events.split(' ').forEach(event => element.addEventListener(event, handler));
}

// Adds a 'focused' attribute to the desired subitem and
// removes it from other sub items to help
// with accessibility and shadow DOm styling.
function focus(item, element) {
    let subs = item.subMenu;
    subs.forEach((sub) => {
        if (sub === element) {
            sub.setAttribute('focused', '');
            item.focused = element;
        } else {
            sub.removeAttribute('focused');
        }
    });
}

},{}],5:[function(require,module,exports){
/*
 * A module for a custom HTML element image-gallery-app to form part of a web component.
 * It combined the component image-gallery with the component draggable-window, to
 * make an image gallery in a window with an added menu.
 * @author Molly Arhammar
 * @version 1.0.0
 *
 */

class ImageGalleryApp extends HTMLElement {
    /**
     * Initiates a gallery-window, sets up shadow DOM.
     */
    constructor() {
        super();
        let galleryWindowTemplate = document.querySelector('link[href="/image-gallery-app.html"]').import.querySelector('#galleryWindowTemplate');

        let shadowRoot = this.attachShadow({mode: "open"});
        let instance = galleryWindowTemplate.content.cloneNode(true);
        shadowRoot.appendChild(instance);

        this.images = [];
    }

    /**
     * Runs when gallery is inserted into the DOM.
     * Sets up event listeners for
     * the menu.
     */
    connectedCallback() {
        let imageGallery = this.shadowRoot.querySelector('image-gallery');
        let aboutspace = this.shadowRoot.querySelector('#about');

        let galleryOption = this.shadowRoot.querySelector('[label="gallery"]');
        let quitOption = this.shadowRoot.querySelector('[label="quit"]');
        let aboutOption = this.shadowRoot.querySelector('[label="about"]');

        this.updateImages();

        //menu event listeners. add separate ones for accessibility reasons with web components.
        quitOption.addEventListener('click', (event) => {
            let target = event.target.focused || event.target.querySelector('[data-task]') || event.target; //shadow DOM accessibility issues
            let task = target.getAttribute('data-task');
            if (task) {
                switch (task) {
                    case 'quit':
                        this.close();
                        break;
                }
            }
        }, true);

        //menu event listener
        galleryOption.addEventListener('click', (event) => {
            let target = event.target.querySelector('[data-task]') || event.target; //shadow DOM accessibility issues
            let task = target.getAttribute('data-task');
            if (task) {
                switch (task) {
                    case 'gallery':
                        aboutspace.classList.add('hide');
                        imageGallery.classList.remove('hide');
                        imageGallery.showThumbnails();
                        break;
                }
            }
        });

        //menu event listener
        aboutOption.addEventListener('click', (event) => {
            let target = event.target.querySelector('[data-task]') || event.target; //shadow DOM accessibility issues
            let task = target.getAttribute('data-task');
            if (task) {
                switch (task) {
                    case 'about':
                        imageGallery.classList.add('hide');
                        aboutspace.classList.remove('hide');
                        break;
                }
            }
        });
    }

    /**
     * Gets all the added images
     * @returns {NodeList} a list of all the image elements that are
     * children of the gallery.
     */
    getImages() {
        return this.querySelectorAll('img');
    }

    /**
     * Gets all the imagedescriptions.
     * @returns {NodeList} a list of all the p elements that are
     * children of the gallery and has a for-attribute.
     */
    getDescriptions() {
        return this.querySelectorAll('p[for]');
    }

    /**
     * Matches descriptions with image-sources via the matching for- and label- attributes
     * on the p and img elements respectively.
     */
    updateImages() {
        let imgTemplate = document.querySelector('link[href="/image-gallery-app.html"]').import.querySelector("#imgTemplate"); //shadow DOM import
        let imageGallery = this.shadowRoot.querySelector('image-gallery');

        this.images = this.images.concat(Array.prototype.slice.call(this.getImages()));
        this.descriptions = this.getDescriptions();

        this.images.forEach((image) => {
            let container = imgTemplate.content.cloneNode(true);
            container.firstElementChild.replaceChild(image, container.firstElementChild.querySelector('img'));
            container.removeChild(container.querySelector('p'));
            imageGallery.appendChild(container);
        });

        Array.prototype.forEach.call(this.descriptions, (description) => {
            imageGallery.appendChild(description);
        });
    }

    /**
     * @returns true if the window containing the app is open.
     */
    get open() {
        return this.shadowRoot.querySelector('draggable-window').open;
    }

    /**
     * @returns true if the window containing the app is minimized.
     */
    get minimized() {
        return this.shadowRoot.querySelector('draggable-window').minimized;
    }

    /**
     * Sets the minimized property of the window containing the app.
     * @param minimize {boolean} whether to minimize
     */
    set minimized(minimize) {
        this.shadowRoot.querySelector('draggable-window').minimized = minimize;
    }

    /**
     * Closes the window containing the app.
     */
    close() {
        this.shadowRoot.querySelector('draggable-window').close();
    }

}


//define the element
customElements.define('image-gallery-app', ImageGalleryApp);

},{}],6:[function(require,module,exports){
/*
 * A module for a custom HTML element image-gallery to form part of a web component.
 * It creates a gallery that displays clickable images as thumbnails.
 * @author Molly Arhammar
 * @version 1.0.0
 *
 */

class ImageGallery extends HTMLElement {
    /**
     * Initiates a gallery, sets up shadow DOM.
     */
    constructor() {
        super();
        let galleryTemplate = document.querySelector('link[href="/image-gallery-app.html"]').import.querySelector('link[href="/image-gallery.html"]').import.querySelector("#galleryTemplate"); //shadow DOM import

        //setup shadow dom styles
        let shadowRoot = this.attachShadow({mode: "open"});
        let instance = galleryTemplate.content.cloneNode(true);
        shadowRoot.appendChild(instance);

    }

    /**
     * Runs when gallery is inserted into the DOM.
     * Sets up event listeners and tracks the picture sources.
     */
    connectedCallback() {
        let gallery = this.shadowRoot.querySelector('#gallery');
        let imageDisplay = this.shadowRoot.querySelector('#imageDisplay');
        let localNav = this.shadowRoot.querySelector('#localNav');

        //make array of all the picture sources for traversing
        this.pictureSources = [];
        Array.prototype.forEach.call(this.querySelectorAll('[slot ="picture"'), (a) => {
            if (a.hasAttribute('src') && this.pictureSources.indexOf(a.getAttribute('src')) === -1) {
                this.pictureSources.push(a.getAttribute('src'));
            } else if (a.firstElementChild && a.firstElementChild.hasAttribute('src') && this.pictureSources.indexOf(a.firstElementChild.getAttribute('src')) === -1) {
                this.pictureSources.push(a.firstElementChild.getAttribute('src'));
            }
        });

        gallery.addEventListener('click', (event) => {
            let src = event.target.getAttribute('src') || event.target.firstElementChild.getAttribute('src');

            if (src) {
                gallery.classList.add('hide');
                imageDisplay.classList.remove('hide');
                this.displayPicture(src, imageDisplay);
            }
        });

        localNav.addEventListener('click', (event) => {
                let task = event.target.getAttribute('data-task');
                let currentPicture = imageDisplay.querySelector('img.displayed');
                let currentPictureSrc = currentPicture.getAttribute('src');
                let nextPictureSrc;

               if (this.querySelectorAll('[slot ="picture"').length !== this.pictureSources.length) { //check if more pictures has been added
                    Array.prototype.forEach.call(this.querySelectorAll('[slot ="picture"'), (a) => { //in that case update sourcelist
                        let src = a.getAttribute('src') || a.firstElementChild.getAttribute('src');
                        if (this.pictureSources.indexOf(src) === -1) {
                            this.pictureSources.push(src);
                        }
                    });
                }

                //traverse through the picture sources
                switch (task) {
                    case 'forward':
                        nextPictureSrc = this.pictureSources.indexOf(currentPictureSrc) + 1;
                        if (nextPictureSrc === this.pictureSources.length) {
                            nextPictureSrc = 0;
                        }
                        nextPictureSrc = this.pictureSources[nextPictureSrc];
                        this.displayPicture(nextPictureSrc, imageDisplay);
                        break;
                    case 'back':
                        nextPictureSrc = this.pictureSources.indexOf(currentPictureSrc) - 1;
                        if (nextPictureSrc < 0) {
                            nextPictureSrc = this.pictureSources.length - 1;
                        }
                        nextPictureSrc = this.pictureSources[nextPictureSrc];
                        this.displayPicture(nextPictureSrc, imageDisplay);
                        break;
                    case 'gallery':
                       this.showThumbnails();
                        break;
                }
        });

        //show full image in separate window if clicked
        imageDisplay.querySelector('a.displayed').addEventListener('click', (event) => {
            let src = event.target.src || event.target.href;
            if (src) {
                open(src);
            }
        });

    }

    /**
     * Displays an image with a description. Description has to have
     * a for-attribute that matches the images label-attribute.
     * @param src {string} the source of the picture to display
     * @param destination {HTMLElement} where to display the image.
     */
    displayPicture(src, destination) {
        let display = destination;
        let img = display.querySelector('img.displayed');
        let a = display.querySelector('a.displayed');
        let p = display.querySelector('p#description');

        let current = this.querySelector('[src="' + src + '"]');
        let label = current.getAttribute('label');
        let descriptionFor = "[for='" + label + "']";
        let description = this.querySelector(descriptionFor).textContent;

        img.src = src;
        a.href = src;
        p.textContent = description;
    }

    /**
     * Shows clickable thumbnails of all the images in the gallery.
     */
    showThumbnails() {
        let gallery = this.shadowRoot.querySelector('#gallery');
        let imageDisplay = this.shadowRoot.querySelector('#imageDisplay');

        gallery.classList.remove('hide');
        imageDisplay.classList.add('hide');

    }
}


//defines the element
customElements.define('image-gallery', ImageGallery);

},{}],7:[function(require,module,exports){
/*
 * A module for a custom HTML element insta-chat-app to form part of a web component.
 * It combined the component insta-chat with the component draggable-window, to
 * make a chat in a window with an added menu.
 * @author Molly Arhammar
 * @version 1.0.0
 *
 */

let InstaChat = require('./insta-chat.js');

class InstaChatApp extends HTMLElement {
    /**
     * Initiates a chat-window, sets up shadow DOM.
     */
    constructor() {
        super();
        let chatWindowTemplate = document.querySelector('link[href="/insta-chat-app.html"]').import.querySelector("#chatWindowTemplate"); //shadow DOM import

        let shadowRoot = this.attachShadow({mode: "open"});
        let instance = chatWindowTemplate.content.cloneNode(true);
        shadowRoot.appendChild(instance);
    }

    /**
     * Runs when chat is inserted into the DOM.
     * Sets up event listeners for
     * the menu, and prints messages
     * saved in local storage if any.
     */
    connectedCallback() {
        //initiate the chat
        let chatspace;

        let namespace = this.shadowRoot.querySelector('#submitName');
        let aboutspace = this.shadowRoot.querySelector('#about');
        let socketspace = this.shadowRoot.querySelector('#chooseSocket');

        let chatoption = this.shadowRoot.querySelector('[label="chat"]');
        let aboutoption = this.shadowRoot.querySelector('[label="about"]');
        let optionoption = this.shadowRoot.querySelector('[label="options"]');

        //check if a socket has already been chosen
        if (localStorage.chatConfig) {
            let config = JSON.parse(localStorage.chatConfig);
            chatspace = new InstaChat(config);

            chatspace.setAttribute('slot', 'content');
            this.shadowRoot.querySelector('draggable-window').appendChild(chatspace);

            //print the last twenty messages from last time
            let messages = chatspace.messageManager.getChatLog().reverse();
            if (messages.length > 0) {
                messages.forEach((message) => {
                    chatspace.print(message);
                });
            }

            //scroll down when window has been rendered
            setTimeout(() => {
                chatspace.shadowRoot.querySelector('#messageWindow').scrollTop = chatspace.shadowRoot.querySelector('#messageWindow').scrollHeight;
            }, 10);

            aboutspace.classList.add('hide');
            socketspace.classList.add('hide');
            namespace.classList.add('hide');
            chatspace.classList.remove('hide');
        } else { //ask for a socket
            aboutspace.classList.add('hide');
            socketspace.classList.remove('hide');
            namespace.classList.add('hide');
        }

        socketspace.querySelector('button').addEventListener('click', (event) => {
            let address = socketspace.querySelector('input#address').value;
            let channel = socketspace.querySelector('input#channel').value;
            let apikey = socketspace.querySelector('input#apikey').value;
            let name = socketspace.querySelector('input#name').value;

            let config = {
                url: address,
                channel: channel,
                key: apikey,
                name: name
            };

            localStorage.chatConfig = JSON.stringify(config);

            chatspace = new InstaChat(config);

            chatspace.setAttribute('slot', 'content');
            this.shadowRoot.querySelector('draggable-window').appendChild(chatspace);

            chatspace.classList.remove('hide');
            namespace.classList.add('hide');
            aboutspace.classList.add('hide');
            socketspace.classList.add('hide');
        });

        namespace.querySelector('button').addEventListener('click', (event) => {
            let name = namespace.querySelector('input').value;
            chatspace.changeConfig({name: name});
            let config = JSON.parse(localStorage.chatConfig);
            config.name = name;
            localStorage.chatConfig = JSON.stringify(config);
            namespace.classList.add('hide');
            aboutspace.classList.add('hide');
            socketspace.classList.add('hide');
            chatspace.classList.remove('hide');
        });

        //event listeners for menu, add separate ones for accessibility reasons
        optionoption.addEventListener('click', (event) => {
            let target = event.target.focused || event.target.querySelector('[data-task]') || event.target;
            let task = target.getAttribute('data-task');
            if (target.getAttribute('data-task')) {
                switch (target.getAttribute('data-task')) {
                    case 'namechange':
                        chatspace.classList.add('hide');
                        aboutspace.classList.add('hide');
                        socketspace.classList.add('hide');
                        namespace.classList.remove('hide');
                        break;
                    case 'socketchange':
                        chatspace.classList.add('hide');
                        aboutspace.classList.add('hide');
                        namespace.classList.add('hide');
                        socketspace.classList.remove('hide');
                        break;
                    case 'quit':
                        this.close();
                        break;
                }
            }
        });

        //avent listener for menu
        aboutoption.addEventListener('click', (event) => {
            let target = event.target.focused || event.target.querySelector('[data-task]') || event.target;
            let task = target.getAttribute('data-task');
            if (target.getAttribute('data-task')) {
                switch (target.getAttribute('data-task')) {
                    case 'about':
                        namespace.classList.add('hide');
                        chatspace.classList.add('hide');
                        socketspace.classList.add('hide');
                        aboutspace.classList.remove('hide');
                        break;
                }
            }
        });

        //event listener for menu
        chatoption.addEventListener('click', (event) => {
            let target = event.target.focused || event.target.querySelector('[data-task]') || event.target;
            let task = target.getAttribute('data-task');
            if (target.getAttribute('data-task')) {
                switch (target.getAttribute('data-task')) {
                    case 'chat':
                        if (chatspace) {
                            chatspace.classList.remove('hide');
                            aboutspace.classList.add('hide');
                            socketspace.classList.add('hide');
                            namespace.classList.add('hide');
                            break;
                        }
                }
            }
        });
    }

    /**
     * Runs when app is removed from the DOM.
     * Closes the window and the web socket.
     */
    disconnectedCallback() {
        this.close();
    }

    /**
     * @returns true if the window containing the app is open.
     */
    get open() {
        return this.shadowRoot.querySelector('draggable-window').open;
    }

    /**
     * @returns true if the window containing the app is minimized.
     */
    get minimized() {
        return this.shadowRoot.querySelector('draggable-window').minimized;
    }

    /**
     * Sets the minimized property of the window containing the app.
     * @param minimize {boolean} whether to minimize
     */
    set minimized(minimize) {
        if (minimize) {
            this.shadowRoot.querySelector('draggable-window').minimized = true;
        } else {
            this.shadowRoot.querySelector('draggable-window').minimized = false;
        }

    }

    /**
     * Closes the window and the web socket.
     */
    close() {
        this.shadowRoot.querySelector('draggable-window').close();
        this.shadowRoot.querySelector('insta-chat').socket.close();
    }
}

//defines the element
customElements.define('insta-chat-app', InstaChatApp);


module.exports = InstaChatApp;

},{"./insta-chat.js":8}],8:[function(require,module,exports){
/*
 * A module for a custom HTML element insta-chat to form part of a web component.
 * It creates a chat connected to a web socket that sends, receives and prints
 * messages.
 * @author Molly Arhammar
 * @version 1.0.0
 *
 */

class InstaChat extends HTMLElement {
    /**
     * Initiates a chat, sets up shadow DOM.
     * @param config {object} a config object with the websockets url, channel, key and a name for the user
     * @param startMessages {[Object]} messages to print at the start of the chat.
     */
    constructor(config = {}, startMessages) {
        super();
        let chatTemplate = document.querySelector('link[href="/insta-chat-app.html"]').import.querySelector('link[href="/insta-chat.html"]').import.querySelector("#chatTemplate"); //shadow DOM import

        //setup shadow dom styles
        let shadowRoot = this.attachShadow({mode: "open"});
        let instance = chatTemplate.content.cloneNode(true);
        shadowRoot.appendChild(instance);

        //set config object as this.config
        this.config = {
            url: config.url || '',
            name: config.name || 'severus snape',
            channel: config.channel || '',
            key: config.key || ''
        };
        this.messages = startMessages || [];
        this.socket = null;
        this.onlineChecker = null;
    }

    /**
     * Runs when chat is inserted into the DOM.
     * Connects to the server, sets up event listeners and prints
     * already saved messages if any.
     */
    connectedCallback() {
        //connect
        this.connect();

        //set event listener to send message on enter
        this.shadowRoot.querySelector('#messageArea').addEventListener('keypress', (event) => {
            if (event.key === 'Enter') {
                this.send(event.target.value);
                event.target.value = '';
                event.preventDefault();
            }
        });

        //if messages to print at start of chat, print each
        if (this.messages.length > 0) {
            this.messages.forEach((message) => {
                this.print(message);
            });
        }
    }

    /**
     * Closes the web socket connection if chat is removed from the DOM.
     */
    disconnectedCallback() {
        this.socket.close();
    }

    /**
     * Connects to the WebSocket server.
     * @returns {Promise} that resolves when the connection is open
     * and rejects with the server response if something went wrong.
     * If a connection is already open, resolves with
     * the socket for that connection.
     */
    connect() {
        return new Promise((resolve, reject) => {

            let socket = this.socket;

            //check for established connection
            if (socket && socket.readyState && socket.url === this.config.url) {
                resolve(socket);
            } else {
                socket = new WebSocket(this.config.url);

                socket.addEventListener('open', () => {
                    resolve(socket);
                });

                socket.addEventListener('error', (event) => {
                    reject(new Error('could not connect to server'));
                });

                socket.addEventListener('message', (event) => {
                    let response = JSON.parse(event.data);
                    if (response.type === 'message') {
                        this.print(response);
                        this.messageManager.setChatLog(response); //save message in local storage
                    } else if (response.type === 'heartbeat') {
                        this.messageManager.getUnsent().forEach((message) => {
                            this.send(message);
                        });
                        this.messageManager.clearUnsent(); //push unsent messages when there is a connection
                    }
                });

                this.socket = socket;
            }

        });

    }

    /**
     * Sends a message to the server.
     * @param message {string} the message to send.
     */
    send(message) {

        let data = {
            type: 'message',
            data: message,
            username: this.config.name,
            channel: this.config.channel,
            key: this.config.key
        };

        this.connect()
            .then((socket) => {
                socket.send(JSON.stringify(data));
        }).catch((response) => {
            this.messageManager.setUnsent(data);
            this.print(data, true); //print message as "unsent" to make it look different;
        });

    }

    /**
     * Prints a message.
     * @param message {Object} the message to print.
     * @param unsent {boolean} true if the message has not been successfully sent
     */
    print(message, unsent) {
        let messageTemplate = document.querySelector('link[href="/insta-chat-app.html"]').import.querySelector('link[href="/insta-chat.html"]').import.querySelector("#messageTemplate"); //message display template

        let chatWindow = this.shadowRoot.querySelector('#messageWindow');
        let messageDiv = document.importNode(messageTemplate.content.firstElementChild, true);
        messageDiv.querySelector('.author').textContent = message.data.username || message.username;
        messageDiv.querySelector('.message').textContent = message.data.data || message.data;

        if (unsent) {
            messageDiv.classList.add('unsent');
        }

        chatWindow.appendChild(messageDiv);
        chatWindow.scrollTop = chatWindow.scrollHeight;
    }

    /**
     * Returns an object to manage messages.
     * @returns {object} the object.
     */
    get messageManager() {
            let storage = localStorage;
            let chatLog = [];
            let unsent = [];

        return {
            /**
             * Retrieves chat log from local storage
             * @returns {Object} the , or undefined if there are no messages
             */
            getChatLog: function() {
                if (storage.chatLog) {
                    chatLog = JSON.parse(storage.chatLog);
                }

                return chatLog;
            },
            /**
             * Retrieves unsent messages from local storage
             * @returns {Object} the messages, or undefined if there are no messages
             */
            getUnsent: function() {
                if (storage.unsent) {
                    unsent = JSON.parse(storage.unsent);
                }

                return unsent;
            },
            /**
             * sets unsent messages in local storage
             * @param message {object} the message object to save
             */
            setUnsent: function(message) {
                let oldMessages;

                if (storage.unsent) {
                    oldMessages = JSON.parse(storage.unsent);
                } else {
                    oldMessages = [];
                }

                oldMessages.unshift(message);

                storage.unsent = JSON.stringify(oldMessages);
            },
            /**
             * Clears unsent messages.
             */
            clearUnsent: function() {
                storage.removeItem('unsent');
            },

            /**
             * Sets sent messages in local storage
             * @param message {object} the message object to save
             */
            setChatLog: function(message) {
                let oldMessages;

                if (storage.chatLog) {
                    oldMessages = JSON.parse(storage.chatLog);
                } else {
                    oldMessages = [];
                }

                oldMessages.unshift(message);

                if (oldMessages.length > 20) { //keep the list to 20 messages
                    oldMessages.length = 20;
                }

                storage.chatLog = JSON.stringify(oldMessages);
            }
        };
    }

    /**
     * Updates the config file.
     * @param config {object} the new values in an object.
     */
    changeConfig(config) {
        this.config.name = config.name || this.config.name;
        this.config.url = config.url|| this.config.url;
        this.config.channel = config.channel || this.config.channel;
        this.config.key = config.key || this.config.key;
    }
}

//defines the element
customElements.define('insta-chat', InstaChat);

module.exports = InstaChat;

},{}],9:[function(require,module,exports){
/*
 * A module for a custom HTML element memory-app to form part of a web component.
 * It combines the component memory-game with the component draggable-window, to
 * make a chat in a window with an added menu.
 * @author Molly Arhammar
 * @version 1.0.0
 *
 */

class MemoryApp extends HTMLElement {
    /**
     * Initiates a memory-window, sets up shadow DOM.
     */
    constructor() {
        super();
        let memoryWindowTemplate = document.querySelector('link[href="/memory-app.html"]').import.querySelector("#memoryWindowTemplate");

        let shadowRoot = this.attachShadow({mode: "open"});
        let instance = memoryWindowTemplate.content.cloneNode(true);
        shadowRoot.appendChild(instance);
    }

    /**
     * Runs when memory-app is inserted into the DOM.
     * Sets up event listeners for
     * the menu and game board size.
     */
    connectedCallback() {
        let gamespace = this.shadowRoot.querySelector('memory-game');
        let highscorespace = this.shadowRoot.querySelector('#highscores');
        let aboutspace = this.shadowRoot.querySelector('#about');

        let game = this.shadowRoot.querySelector('memory-game');
        let gameOptions = this.shadowRoot.querySelector('[label="game"]');
        let highscoresOption = this.shadowRoot.querySelector('[label="highscore"]');
        let aboutOption = this.shadowRoot.querySelector('[label="about"]');

        //menu event listeners, add separate ones for accessibility reasons
        gameOptions.addEventListener('click', (event) => {
            let target = event.target.focused || event.target.querySelector('[data-task]') || event.target; //shadow DOM accessibility issues
            let task = target.getAttribute('data-task');
                if (task) {
                    switch (task) {
                        case 'restart':
                            gamespace.classList.remove('hide');
                            highscorespace.classList.add('hide');
                            aboutspace.classList.add('hide');
                            gamespace.replay();
                            break;
                        case 'new':
                            gamespace.classList.remove('hide');
                            highscorespace.classList.add('hide');
                            aboutspace.classList.add('hide');
                            gamespace.restart();
                            break;
                        case 'quit':
                            this.close();
                            break;
                    }
                }
        }, true);

        //menu event listener
        highscoresOption.addEventListener('click', (event) => {
            let target = event.target.querySelector('[data-task]') || event.target; //shadow DOM accessibility issues
            let task = target.getAttribute('data-task');
            if (task) {
                switch (task) {
                    case 'highscores':
                        game.end();
                        this.updateHighscores(game.result);
                        gamespace.classList.add('hide');
                        highscorespace.classList.remove('hide');
                        aboutspace.classList.add('hide');
                        break;
                }
            }
        });

        //menu event listener
        aboutOption.addEventListener('click', (event) => {
            let target = event.target.querySelector('[data-task]') || event.target; //shadow DOM accessibility issues
            let task = target.getAttribute('data-task');
            if (task) {
                switch (task) {
                    case 'about':
                        gamespace.classList.add('hide');
                        highscorespace.classList.add('hide');
                        aboutspace.classList.remove('hide');
                        break;
                }
            }
        });

        //board size event listener
        this.addEventListener('click', (event) => {
            let target = event.path[0];
            if (target.getAttribute('boardsize')) {
                this.user = this.shadowRoot.querySelector('#intro input').value || 'stranger'; //get the name when board size is chosen
                switch (target.getAttribute('boardsize')) {
                    case '44':
                        game.width = 4;
                        game.height = 4;
                        game.draw();
                        game.play();
                        break;
                    case '42':
                        game.width = 4;
                        game.height = 2;
                        game.draw();
                        game.play();
                        break;
                    case '24':
                        game.width = 2;
                        game.height = 4;
                        game.draw();
                        game.play();
                        break;
                }
            }
        });

    }

    /**
     * Runs when app is removed from the DOM.
     * Closes the window.
     */
    disconnectedCallback() {
        this.close();
    }

    /**
     * Updates highscores by setting them in the local storage
     * and displaying dem.
     * @param result
     */
    updateHighscores(result) {
        let highscoresTemplate = document.querySelector('link[href="/memory-app.html"]').import.querySelector("#highscoresTemplate");

        let highscores = {
            storage: localStorage,
            scores: undefined,
            /**
             * Retrieves highscores from local storage
             * @returns {Object} the highscore-list, or undefined if there are no highscores
             */
            getHighScores: function () {
                if (this.storage.memoryHighScores) {
                    this.scores = JSON.parse(this.storage.memoryHighScores);
                }

                return this.scores;
            },
            /**
             * sets highscores in local storage
             * @param user {string} the users name
             * @param newScore {number} the score to set
             */
            setHighScores: function (user, newScore) {
                let oldHighScores;
                let newHighScores;

                if (this.storage.memoryHighScores) {
                    oldHighScores = JSON.parse(this.storage.memoryHighScores);
                } else {
                    oldHighScores = [];
                }

                oldHighScores.push({user: user, score: newScore});

                newHighScores = oldHighScores.sort((a, b) => { //sort
                    return a.score - b.score;
                });

                if (newHighScores.length > 5) { //keep the list to 5 scores
                    newHighScores.length = 5;
                }

                this.storage.memoryHighScores = JSON.stringify(newHighScores);
            }
        };

        if (result) { //a new result is present
            let score = (result.turns * result.time) / (this.shadowRoot.querySelector('memory-game').height * this.shadowRoot.querySelector('memory-game').width);
            highscores.setHighScores(this.user, score);
            this.shadowRoot.querySelector('memory-game').result = undefined; //clean the result
        }

        //display the scores
        let scores = highscores.getHighScores();
        let highscoreDisplay = this.shadowRoot.querySelector('#highscoreDisplay');
        let oldList = highscoreDisplay.querySelector('ul');
        let list = document.importNode(highscoresTemplate.content.querySelector("ul"), true);
        let entry;

        if (scores) {
            scores.forEach((score) => {
                entry = document.importNode((list.querySelector("li")));
                entry.textContent = score.user + ": " + score.score;
                list.appendChild(entry);
            });
        } else {
            entry = document.importNode((list.querySelector("li")));
            entry.textContent = "-";
            list.appendChild(entry);
        }

        if (!oldList) { //if scores have already been displayed, replace them
            highscoreDisplay.appendChild(list);
        } else {
            highscoreDisplay.replaceChild(list, oldList);
        }
    }

    /**
     * @returns true if the window containing the app is open.
     */
    get open() {
        return this.shadowRoot.querySelector('draggable-window').open;
    }

    /**
     * @returns true if the window containing the app is minimized.
     */
    get minimized() {
        return this.shadowRoot.querySelector('draggable-window').minimized;
    }

    /**
     * Sets the minimized property of the window containing the app.
     * @param minimize {boolean} whether to minimize
     */
    set minimized(minimize) {
        this.shadowRoot.querySelector('draggable-window').minimized = minimize;
    }

    /**
     * Removes the node and closes the window.
     */
    close() {
        this.parentNode.removeChild(this);
        this.shadowRoot.querySelector('draggable-window').close();
    }

}

//helper function
//adds multiple event listeners with identical handlers
function addEventListeners(element, events, handler) {
    events.split(' ').forEach(event => element.addEventListener(event, handler));
}

//define the element
customElements.define('memory-app', MemoryApp);

},{}],10:[function(require,module,exports){
/*
 * A module for a custom HTML element memory-game to form part of a web component.
 * It creates a memory game with a timer a a turn-counter. The game is over when
 * all bricks have been paired and stores the total time and turns in a result-variable.
 * @author Molly Arhammar
 * @version 1.0.0
 *
 */

//requires
let Timer = require('./timer.js');


class MemoryGame extends HTMLElement {
    /**
     * Initiates a memory game, sets up shadow DOM.
     */
    constructor(width, height) {
        super();
        let memoryTemplate = document.querySelector('link[href="/memory-app.html"]').import.querySelector('link[href="/memory-game.html"]').import.querySelector("#memoryTemplate"); //shadow DOM import

        //setup shadow dom styles
        let shadowRoot = this.attachShadow({mode: "open"});
        let instance = memoryTemplate.content.cloneNode(true);
        shadowRoot.appendChild(instance);

        //set width and height attributes
        this.setAttribute('data-width', width || this.getAttribute('data-width') || 4);
        this.setAttribute('data-height', height || this.getAttribute('data-height')  || 4);

        //set references
        this.set = [];
        this.timer = new Timer(0);
        this.gamePlay = undefined;
        this.timespan = this.shadowRoot.querySelector("#timespan");
        this.turnspan = this.shadowRoot.querySelector("#turnspan");

    }

    /**
     * Runs when memory is inserted into the DOM.
     * Adds event listeners and renders a board with bricks.
     */
    connectedCallback() {
        this.shadowRoot.querySelector('#intro button').addEventListener('click', (event) => {
            this.play();
        });

        this.draw();
    }

    /**
     * @returns {string} the width of the board in bricks
     */
    get width() {
        return this.getAttribute('data-width');
    }

    /**
     * Sets the width of the board in bricks.
     * @param newVal {string} the new width of the board in bricks
     */
    set width(newVal) {
        this.setAttribute('data-width', newVal);
    }

    /**
     * @returns {string} the height of the board in bricks
     */
    get height() {
        return this.getAttribute('data-height');
    }

    /**
     * Sets the height of the board in bricks.
     * @param newVal {string} the new height of the board in bricks
     */
    set height(newVal) {
        this.setAttribute('data-height', newVal);
    }

    /**
     * Shuffles the bricks using Fisher-Yates algorithm.
     */
    shuffle() {
        let theSet = this.set;
        for (let i = (theSet.length - 1); i > 0; i -= 1) {
            let j = Math.floor(Math.random() * i);
            let iOld = theSet[i];
            theSet[i] = theSet[j];
            theSet[j] = iOld;
        }
        this.set = theSet;
    }

    /**
     * Adds the bricks to the board and renders them in the DOM.
     */
    draw() {
        let brickTemplate = document.querySelector('link[href="/memory-app.html"]').import.querySelector('link[href="/memory-game.html"]').import.querySelector("#brickTemplate"); //brick template

        let brick;
        let match;
        let pairs = Math.round((this.width * this.height)) / 2;
        this.set = [];
        let oldBricks = this.children;

        //remove old bricks if any
        for (let i = oldBricks.length -1; i >= 0; i -= 1) {
            let brick = oldBricks[i];
            if (brick.getAttribute('slot') === 'brick') {
                brick.parentNode.removeChild(brick);
            }
        }

        //initiate bricks
        for (let i = 1; i <= pairs; i += 1) {
            brick = new Brick(i);
            this.set.push(brick);
            match = brick.clone();
            this.set.push(match);
        }
        let theSet = this.set;

        //put them in the dom
        for (let i = 0; i < theSet.length; i += 1) {
            let brickDiv = document.importNode(brickTemplate.content, true);
            let img = brickDiv.querySelector("img");
            let brick = theSet[i];
            img.src = '/image/memory-brick-' + brick.draw() + '.png';
            img.setAttribute("brickNumber", i);
            this.appendChild(brickDiv);

            if ((i + 1) % this.width === 0) {
                let br = document.createElement("br");
                br.setAttribute('slot', 'brick');
                this.appendChild(br);
            }
        }
    }

    /**
     * Starts a game, plays it through, saves the result and
     * then displays the outro.
     */
    play() {
        this.shuffle();
        this.shadowRoot.querySelector("#intro").classList.add('hide');
        this.shadowRoot.querySelector("#main").classList.remove('hide');
        this.shadowRoot.querySelector("#outro").classList.add('hide');
        this.timer.start(0);
        this.timer.display(this.timespan);
        playGame(this.set, this)
            .then((result) => {
                result.time = this.timer.stop();
                this.result = result;
                this.shadowRoot.querySelector("#intro").classList.add('hide');
                this.shadowRoot.querySelector("#main").classList.add('hide');
                this.shadowRoot.querySelector("#outro").classList.remove('hide');
            });
    }

    /**
     * Restarts the game with the same size of board without re-rendering
     */
    replay() {
        this.reset();
        this.shadowRoot.querySelector("#intro").classList.add('hide');
        this.shadowRoot.querySelector("#main").classList.remove('hide');
        this.shadowRoot.querySelector("#outro").classList.add('hide');
        this.play();
    }

    /**
     * Resets the game and then lets the user choose a new game size and
     * user name, re-rendering the board.
     */
    restart() {
        this.reset();
        this.shadowRoot.querySelector("#intro").classList.remove('hide');
        this.shadowRoot.querySelector("#main").classList.add('hide');
        this.shadowRoot.querySelector("#outro").classList.add('hide');
    }

    /**
     * Resets the game to make it playable again. Removes event listeners
     * and turns the bricks over.
     */
    reset() {
        let bricks = this.querySelectorAll('[slot="brick"]');
        Array.prototype.forEach.call(bricks, (brick) => {
            brick.removeAttribute('hidden');
            let img = brick.querySelector("img");
            if (img) {
                let brickNumber = img.getAttribute("brickNumber");
                if (this.set[brickNumber].draw() !== 0) { //turn the brick over if it's not turned
                    img.src = '/image/memory-brick-' + this.set[brickNumber].turn() + '.png';
                }
            }
        });
        this.timespan.textContent = '';
        this.turnspan.textContent = '';
        this.timer.stop(); //make sure timer is stopped
        this.shadowRoot.querySelector('#board').removeEventListener("click", this.gamePlay);
    }

    /**
     * Ends the game and displays the outro.
     */
    end() {
        this.reset();
        this.shadowRoot.querySelector("#intro").classList.add('hide');
        this.shadowRoot.querySelector("#main").classList.add('hide');
        this.shadowRoot.querySelector("#outro").classList.remove('hide');
    }
}

//defines the element
customElements.define('memory-game', MemoryGame);


/**
 * A class Brick to go with the memory game.
 */
class Brick {
    /**
     * Initiates the Brick with a value and places it facedown.
     * @param number {number} the value to initiate.
     */
    constructor(number) {
        this.value = number;
        this.facedown = true;
    }

    /**
     * Turns the brick and returns the value after the turn.
     * @returns {number} the value of the brick if it's faceup, otherwise 0.
     */
    turn() {
        this.facedown = !(this.facedown);
        return this.draw();
    }

    /**
     * Compares two bricks.
     * @param other {Brick} the Brick to compare.
     * @returns {boolean} true if the bricks values are equal.
     */
    equals(other) {
        return (other instanceof Brick) && (this.value === other.value);
    }

    /**
     * Clones the brick.
     * @returns {Brick} the clone.
     */
    clone() {
        return new Brick(this.value);
    }

    /**
     * @returns {number} the brick's value, or 0 if it is face down.
     */
    draw() {
        if (this.facedown) {
            return 0;
        } else {
            return this.value;
        }
    }
}

/**
 * A function that sets up the gameplay. Adds and removes event-listeners so that the same game can be reset.
 * @param set [{Brick]} the set of bricks to play with.
 * @param game {node} the space to play
 * @returns {Promise} a promise that resolves with the result of the game when the game has been played.
 */
function playGame(set, game) {
    let turns = 0;
    let bricks = parseInt(game.width) * parseInt(game.height);
    let board = game.shadowRoot.querySelector('#board');
    let bricksLeft = bricks;
    let choice1;
    let choice2;
    let img1;
    let img2;

    return new Promise((resolve, reject) => {
        game.gamePlay = function(event) { //expose the reference so the event listener can be removed from outside the function
            if (!choice2) { //if two bricks are not turned
                let img = event.target.querySelector("img") || event.target;
                let brickNumber = img.getAttribute("brickNumber");
                if (!brickNumber) { //target is not a brick
                    return;
                }

                let brick = set[brickNumber];
                img.src = '/image/' + brick.turn() + '.png';

                if (!choice1) { //first brick to be turned
                    img1 = img;
                    choice1 = brick;
                } else { //second brick to be turned
                    img2 = img;
                    choice2 = brick;

                    if (choice1.equals(choice2) && img1.getAttribute('brickNumber') !== img2.getAttribute('brickNumber')) { //the two bricks are equal but not the same
                        img1.parentElement.parentElement.setAttribute('hidden', '');
                        img2.parentElement.parentElement.setAttribute('hidden', '');
                        choice1 = "";
                        choice2 = "";
                        img1 = "";
                        img2 = "";
                        bricksLeft -= 2;
                        if (bricksLeft === 0) { //all bricks are turned
                            resolve({turns: turns});
                        }
                    } else { //bricks are not the same
                        setTimeout(() => {
                            img1.src = '/image/' + choice1.turn() + '.png';
                            img2.src = '/image/' + choice2.turn() + '.png';
                            choice1 = "";
                            choice2 = "";
                            img1 = "";
                            img2 = "";
                        }, 1000);
                    }

                    turns += 1;
                    game.turnspan.textContent = turns;
                }

            }
            event.preventDefault();

        };

        board.addEventListener("click", game.gamePlay);

    });

}

},{"./timer.js":11}],11:[function(require,module,exports){
/**
 * Module for Timer.
 *
 * @author Molly Arhammar
 * @version 1.0.0
 */

class Timer {
    /**
     * Initiates a Timer.
     * @param startTime {number} where to start counting.
     */
    constructor(startTime = 0) {
        this.count = startTime;
    }

    /**
     * @returns {number} the count
     */
    get time() {
        return this.count;
    }

    /**
     * Sets the time on the timer.
     * @param newTime {number} the new time
     */
    set time(newTime) {
        this.count = newTime;
    }
    /**
     * starts the timer. increments time every 100 milliseconds.
     * @param time {number} what number to start it on.
     */
    start(time = this.time) {
        this.count = time;
        this.timer = setInterval(() => {
            this.count += 100;
        }, 100);
    }
    /**
     * starts the timer. decrements time every 100 milliseconds.
     * @param time {number} what number to start it on.
     */
    countdown(time) {
        this.count = time || this.count;
        this.timer = setInterval(() => {
            this.count -= 100;
        }, 100);
    }
    /**
     * stops the Timer.
     * @returns the count.
     */
    stop() {
        clearInterval(this.timer);
        clearInterval(this.displayInterval);
        return this.count;
    }
    /**
     * Displays a rounded value of the count of the timer
     * to the desired precision, at an interval.
     * @param destination {node} where to make the display
     * @param interval {number} the interval to make the display in, in milliseconds
     * @param precision {number}the number to divide the displayed milliseconds by
     * @returns the interval.
     *
     */
    display(destination, interval = 100, precision = 1000) {
        this.displayInterval = setInterval( ()=> {
            destination.textContent = Math.round(this.count / precision);
        }, interval);
        return this.displayInterval;
    }
}

module.exports = Timer;

},{}]},{},[1])
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIi4uLy4uL2hvbWUvdmFncmFudC8ubnZtL3ZlcnNpb25zL25vZGUvdjcuMy4wL2xpYi9ub2RlX21vZHVsZXMvd2F0Y2hpZnkvbm9kZV9tb2R1bGVzL2Jyb3dzZXItcGFjay9fcHJlbHVkZS5qcyIsImNsaWVudC9zb3VyY2UvanMvYXBwLmpzIiwiY2xpZW50L3NvdXJjZS9qcy9kZXNrdG9wLmpzIiwiY2xpZW50L3NvdXJjZS9qcy9kcmFnZ2FibGUtd2luZG93LmpzIiwiY2xpZW50L3NvdXJjZS9qcy9leHBhbmRhYmxlLW1lbnUtaXRlbS5qcyIsImNsaWVudC9zb3VyY2UvanMvaW1hZ2UtZ2FsbGVyeS1hcHAuanMiLCJjbGllbnQvc291cmNlL2pzL2ltYWdlLWdhbGxlcnkuanMiLCJjbGllbnQvc291cmNlL2pzL2luc3RhLWNoYXQtYXBwLmpzIiwiY2xpZW50L3NvdXJjZS9qcy9pbnN0YS1jaGF0LmpzIiwiY2xpZW50L3NvdXJjZS9qcy9tZW1vcnktYXBwLmpzIiwiY2xpZW50L3NvdXJjZS9qcy9tZW1vcnktZ2FtZS5qcyIsImNsaWVudC9zb3VyY2UvanMvdGltZXIuanMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7QUNBQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUMzRUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzFRQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ2pQQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDM0pBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDN0pBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDM0lBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDNU5BO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDaFFBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQy9QQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3ZWQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EiLCJmaWxlIjoiZ2VuZXJhdGVkLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXNDb250ZW50IjpbIihmdW5jdGlvbiBlKHQsbixyKXtmdW5jdGlvbiBzKG8sdSl7aWYoIW5bb10pe2lmKCF0W29dKXt2YXIgYT10eXBlb2YgcmVxdWlyZT09XCJmdW5jdGlvblwiJiZyZXF1aXJlO2lmKCF1JiZhKXJldHVybiBhKG8sITApO2lmKGkpcmV0dXJuIGkobywhMCk7dmFyIGY9bmV3IEVycm9yKFwiQ2Fubm90IGZpbmQgbW9kdWxlICdcIitvK1wiJ1wiKTt0aHJvdyBmLmNvZGU9XCJNT0RVTEVfTk9UX0ZPVU5EXCIsZn12YXIgbD1uW29dPXtleHBvcnRzOnt9fTt0W29dWzBdLmNhbGwobC5leHBvcnRzLGZ1bmN0aW9uKGUpe3ZhciBuPXRbb11bMV1bZV07cmV0dXJuIHMobj9uOmUpfSxsLGwuZXhwb3J0cyxlLHQsbixyKX1yZXR1cm4gbltvXS5leHBvcnRzfXZhciBpPXR5cGVvZiByZXF1aXJlPT1cImZ1bmN0aW9uXCImJnJlcXVpcmU7Zm9yKHZhciBvPTA7bzxyLmxlbmd0aDtvKyspcyhyW29dKTtyZXR1cm4gc30pIiwiLyoqXG4gKiBTdGFydGluZyBwb2ludCBmcHIgdGhlIGFwcGxpY2F0aW9uLlxuICogVGhlIGFwcGxpY2F0aW9uIHdvdWxkIHdvcmsgYmV0dGVyIHdoZW4gdXNlZCB3aXRoIEhUVFAyXG4gKiBkdWUgdG8gdGhlIGZhY3QgdGhhdCBpdCBtYWtlcyB1c2Ugb2Ygd2ViLWNvbXBvbmVudHMsXG4gKiBidXQgaXQncyBiZWVuIGJ1aWx0IHdpdGggYnJvd3NlcmlmeSB0byB3b3JrIGFzIGFcbiAqIG5vcm1hbCBIVFRQMSBhcHBsaWNhdGlvbiBpbiBsaWV1IG9mIHRoaXMuXG4gKiBAYXV0aG9yIE1vbGx5IEFyaGFtbWFyXG4gKiBAdmVyc2lvbiAxLjBcbiAqL1xuXG5cbi8vdG8gbWFrZSB3ZWIgY29tcG9uZW50cyB3b3JrIHdpdGggYnJvd3NlcmlmeVxubGV0IHdpbmRvdyA9IHJlcXVpcmUoJy4vZHJhZ2dhYmxlLXdpbmRvdy5qcycpO1xubGV0IG1lbnUgPSByZXF1aXJlKFwiLi9leHBhbmRhYmxlLW1lbnUtaXRlbS5qc1wiKTtcbmxldCBtZW1vcnlHYW1lID0gcmVxdWlyZSgnLi9tZW1vcnktZ2FtZS5qcycpO1xubGV0IG1lbW9yeUFwcCA9IHJlcXVpcmUoJy4vbWVtb3J5LWFwcC5qcycpO1xubGV0IGluc3RhQ2hhdD0gcmVxdWlyZSgnLi9pbnN0YS1jaGF0LmpzJyk7XG5sZXQgaW5zdGFDaGF0QXBwID0gcmVxdWlyZSgnLi9pbnN0YS1jaGF0LWFwcC5qcycpO1xubGV0IGltYWdlR2FsbGVyeSA9IHJlcXVpcmUoJy4vaW1hZ2UtZ2FsbGVyeS5qcycpO1xubGV0IGltYWdlR2FsbGVyeUFwcCA9IHJlcXVpcmUoJy4vaW1hZ2UtZ2FsbGVyeS1hcHAuanMnKTtcblxuLy9yZXF1aXJlc1xubGV0IERlc2t0b3AgPSByZXF1aXJlKFwiLi9kZXNrdG9wLmpzXCIpO1xuXG4vL25vZGVzXG5sZXQgbWFpbk1lbnUgPSBkb2N1bWVudC5xdWVyeVNlbGVjdG9yKFwiI3dpbmRvd1NlbGVjdG9yXCIpO1xubGV0IHN1Yk1lbnVUZW1wbGF0ZSA9IGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3IoXCIjc3ViTWVudVwiKTtcbmxldCB3aW5kb3dTcGFjZSA9IGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3IoXCIjb3BlbldpbmRvd3NcIik7XG5cbi8vdmFyaWFibGVzXG5sZXQgbXlEZXNrdG9wO1xubGV0IHdpbmRvd01hbmFnZXIgPSBEZXNrdG9wLndpbmRvd01hbmFnZXIod2luZG93U3BhY2UpO1xuXG5cbi8vc2V0IHVwIGV2ZW50IGhhbmRsZXIgZm9yIHN1Yi1tZW51XG5sZXQgZXZlbnRIYW5kbGVyU3ViTWVudSA9IGZ1bmN0aW9uIChldmVudCkge1xuICAgIGxldCB0eXBlID0gZXZlbnQudGFyZ2V0LmdldEF0dHJpYnV0ZSgnZGF0YS1raW5kJykgfHwgZXZlbnQudGFyZ2V0LnBhcmVudE5vZGUuZ2V0QXR0cmlidXRlKCdkYXRhLWtpbmQnKTtcblxuICAgIHN3aXRjaCAoZXZlbnQudGFyZ2V0LmdldEF0dHJpYnV0ZSgnZGF0YS10YXNrJykpIHtcbiAgICAgICAgY2FzZSAnb3Blbic6XG4gICAgICAgICAgICB3aW5kb3dNYW5hZ2VyLmNyZWF0ZVdpbmRvdyh0eXBlKS5mb2N1cygpO1xuICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgIGNhc2UgJ2Nsb3NlJzpcbiAgICAgICAgICAgIHdpbmRvd01hbmFnZXIuY2xvc2UodHlwZSk7XG4gICAgICAgICAgICBicmVhaztcbiAgICAgICAgY2FzZSAnbWluaW1pemUnOlxuICAgICAgICAgICAgd2luZG93TWFuYWdlci5taW5pbWl6ZSh0eXBlKTtcbiAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICBjYXNlICdleHBhbmQnOlxuICAgICAgICAgICAgd2luZG93TWFuYWdlci5leHBhbmQodHlwZSk7XG4gICAgICAgICAgICBicmVhaztcbiAgICAgICAgZGVmYXVsdDpcbiAgICAgICAgICAgIGJyZWFrO1xuICAgIH1cbiAgICBpZiAoZXZlbnQudHlwZSA9PT0gJ2NsaWNrJykge1xuICAgICAgICBldmVudC5wcmV2ZW50RGVmYXVsdCgpO1xuICAgIH1cbn07XG5cbmxldCBkZXNrdG9wQ29uZmlnID0ge1xuICAgIHNwYWNlOiB3aW5kb3dTcGFjZSxcbiAgICBtZW51OiBtYWluTWVudSxcbiAgICB3aW5kb3dNYW5hZ2VyOiB3aW5kb3dNYW5hZ2VyLFxuICAgIHN1YlRlbXBsYXRlOiBzdWJNZW51VGVtcGxhdGUsXG4gICAgc3ViSGFuZGxlcjogZXZlbnRIYW5kbGVyU3ViTWVudVxufTtcblxuXG4vL2luaXRpYXRlIGRlc2t0b3Bcbm15RGVza3RvcCA9IG5ldyBEZXNrdG9wKGRlc2t0b3BDb25maWcpO1xuXG4vL2luaXRpYXRlIHNlcnZpY2V3b3JrZXJcbm5hdmlnYXRvci5zZXJ2aWNlV29ya2VyLnJlZ2lzdGVyKCcuL3N3LWJ1aWxkLmpzJywge1xuICAgIHNjb3BlOiAnLydcbn0pO1xuIiwiLyoqXG4gKiBBIG1vZHVsZSBmb3IgYSBjbGFzcyBkZXNrdG9wLlxuICogSW5pdGlhdGVzIGEgd2ViIGRlc2t0b3Agd2l0aCBhIG1lbnVcbiAqIGFuZCB3aW5kb3dzIHRvIG9wZW4uXG4gKlxuICogQGF1dGhvciBNb2xseSBBcmhhbW1hclxuICogQHZlcnNpb24gMS4wXG4gKi9cblxuXG5jbGFzcyBEZXNrdG9wIHtcbiAgICAvKipcbiAgICAgKiBJbml0aWF0ZXMgdGhlIERlc2t0b3AuIFNldHMgdXAgZXZlbnQgbGlzdGVuZXJzXG4gICAgICogYW5kIGFkZHMgc3ViLW1lbnUgdG8gdGhlIG1haW4gbWVudSBpdGVtcyBpZiBzdWNoIGFyZSBwcm92aWRlZC5cbiAgICAgKiBAcGFyYW0gZGVza3RvcENvbmZpZyB7b2JqZWN0fSB3aXRoIHBhcmFtczpcbiAgICAgKiBtZW51IHtbZXhwYW5kYWJsZS1tZW51LWl0ZW1dfSxcbiAgICAgKiBzcGFjZToge25vZGV9IHdoZXJlIHRoZSBkZXNrdG9wIHdpbmRvd3MgbGl2ZXNcbiAgICAgKiBhbmQgb3B0aW9uYWw6XG4gICAgICogd2luZG93TWFuYWdlcjoge29iamVjdH0gYSBjdXN0b20gd2luZG93IG1hbmFnZXIgdGhhdCBoYW5kbGVzIHRoZSB3aW5kb3dzLCB3aWxsIG90aGVyd2lzZSBiZSBzdXBwbGllZFxuICAgICAqIHN1YlRlbXBsYXRlOiB7ZG9jdW1lbnQtZnJhZ21lbnR9IGEgc3ViLW1lbnUgdG8gYmUgYWRkZWQgdG8gZWFjaCBvZiB0aGUgbWFpbiBtZW51IGl0ZW1zXG4gICAgICogc3ViSGFuZGxlciB7ZnVuY3Rpb259IGFuIGV2ZW50IGhhbmRsZXIgdG8gYmUgYXBwbGllcyB0byB0aGUgc3ViIG1lbnVcbiAgICAgKi9cbiAgICBjb25zdHJ1Y3RvcihkZXNrdG9wQ29uZmlnKSB7XG4gICAgICAgIGxldCB0b3BXaW5kb3cgPSAyOyAvL3RvIGtlZXAgZm9jdXNlZCB3aW5kb3cgb24gdG9wXG5cbiAgICAgICAgbGV0IG1haW5NZW51ID0gZGVza3RvcENvbmZpZy5tZW51O1xuICAgICAgICBsZXQgd2luZG93U3BhY2UgPSBkZXNrdG9wQ29uZmlnLnNwYWNlO1xuICAgICAgICBsZXQgd2luZG93TWFuYWdlciA9IGRlc2t0b3BDb25maWcud2luZG93TWFuYWdlciB8fCBEZXNrdG9wLndpbmRvd01hbmFnZXIod2luZG93U3BhY2UpOyAvL3N1cHBseSB3aW5kb3dNYW5hZ2VyIGlmIHRoZXJlIGlzIG5vbmVcbiAgICAgICAgbGV0IHN1Yk1lbnVUZW1wbGF0ZSA9IGRlc2t0b3BDb25maWcuc3ViVGVtcGxhdGU7XG4gICAgICAgIGxldCBzdWJIYW5kbGVyID0gZGVza3RvcENvbmZpZy5zdWJIYW5kbGVyO1xuXG5cbiAgICAgICAgaWYgKHN1Yk1lbnVUZW1wbGF0ZSkgeyAvL3RoZXJlIGlzIGEgc3VibWVudVxuICAgICAgICAgICAgLy9hZGQgdGhlIHN1Ym1lbnVcbiAgICAgICAgICAgIEFycmF5LnByb3RvdHlwZS5mb3JFYWNoLmNhbGwobWFpbk1lbnUuY2hpbGRyZW4sIChub2RlKSA9PiB7XG4gICAgICAgICAgICAgICAgbGV0IHN1Yk1lbnUgPSBkb2N1bWVudC5pbXBvcnROb2RlKHN1Yk1lbnVUZW1wbGF0ZS5jb250ZW50LCB0cnVlKTtcbiAgICAgICAgICAgICAgICB0aGlzLmFkZFN1Yk1lbnUobm9kZSwgc3ViTWVudSwgc3ViSGFuZGxlcik7XG4gICAgICAgICAgICB9KTtcblxuICAgICAgICAgICAgLy9hZGQgZXZlbnQgaGFuZGxlcnMgb24gdGhlIHN1YiBtZW51XG4gICAgICAgICAgICBhZGRFdmVudExpc3RlbmVycyhtYWluTWVudSwgJ2NsaWNrIGZvY3Vzb3V0JywgKGV2ZW50KSA9PiB7XG4gICAgICAgICAgICAgICAgbGV0IG1haW5NZW51SXRlbXMgPSBtYWluTWVudS5xdWVyeVNlbGVjdG9yQWxsKCdleHBhbmRhYmxlLW1lbnUtaXRlbScpO1xuICAgICAgICAgICAgICAgIG1haW5NZW51SXRlbXMuZm9yRWFjaCgoaXRlbSkgPT4ge1xuICAgICAgICAgICAgICAgICAgICBpZiAoKGl0ZW0gIT09IGV2ZW50LnRhcmdldCAmJiBpdGVtICE9PSBldmVudC50YXJnZXQucGFyZW50RWxlbWVudCkgJiYgKGl0ZW0uZGlzcGxheWluZ1N1Yk1lbnUpKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBpdGVtLnRvZ2dsZVN1Yk1lbnUoZmFsc2UpO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfSlcbiAgICAgICAgICAgIH0pO1xuICAgICAgICB9XG5cbiAgICAgICAgLy9vcGVuIG5ldyB3aW5kb3cgYXQgZG91YmxlIGNsaWNrXG4gICAgICAgIG1haW5NZW51LmFkZEV2ZW50TGlzdGVuZXIoJ2RibGNsaWNrJywgKGV2ZW50KSA9PiB7XG4gICAgICAgICAgICBsZXQgdHlwZSA9IGV2ZW50LnRhcmdldC5nZXRBdHRyaWJ1dGUoXCJkYXRhLWtpbmRcIikgfHwgZXZlbnQudGFyZ2V0LnBhcmVudE5vZGUuZ2V0QXR0cmlidXRlKFwiZGF0YS1raW5kXCIpO1xuICAgICAgICAgICAgaWYgKHR5cGUpIHtcbiAgICAgICAgICAgICAgICB3aW5kb3dNYW5hZ2VyLmNyZWF0ZVdpbmRvdyh0eXBlKS5mb2N1cygpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgZXZlbnQucHJldmVudERlZmF1bHQoKTtcbiAgICAgICAgfSk7XG5cbiAgICAgICAgLy9wdXQgZm9jdXNlZCB3aW5kb3cgb24gdG9wXG4gICAgICAgIHdpbmRvd1NwYWNlLmFkZEV2ZW50TGlzdGVuZXIoJ2ZvY3VzJywgKGV2ZW50KSA9PiB7XG4gICAgICAgICAgICBpZiAoZXZlbnQudGFyZ2V0ICE9PSB3aW5kb3dTcGFjZSkge1xuICAgICAgICAgICAgICAgIGV2ZW50LnRhcmdldC5zdHlsZS56SW5kZXggPSB0b3BXaW5kb3c7XG4gICAgICAgICAgICAgICAgdG9wV2luZG93ICs9IDE7XG4gICAgICAgICAgICB9XG4gICAgICAgIH0sIHRydWUpO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIEBwYXJhbSBpdGVtIHtIVE1MRWxlbWVudH0gdGhlIGV4cGFuZGFibGUtbWVudS1pdGVtIHRvIGFkZCB0aGUgc3ViLW1lbnUgdG9cbiAgICAgKiBAcGFyYW0gc3ViTWVudSB7SFRNTEVsZW1lbnR9IGEgdGVtcGxhdGUgb2YgdGhlIHN1Yi1tZW51XG4gICAgICogQHBhcmFtIGV2ZW50SGFuZGxlciB7ZnVuY3Rpb259IHRoZSBldmVudCBoYW5kbGVyIHRvIGJlIGFwcGxpZWQgdG8gdGhlIHN1YiBtZW51XG4gICAgICovXG4gICAgYWRkU3ViTWVudShpdGVtLCBzdWJNZW51LCBldmVudEhhbmRsZXIpIHtcbiAgICAgICAgbGV0IGxhYmVsID0gaXRlbS5nZXRBdHRyaWJ1dGUoJ2xhYmVsJyk7XG5cbiAgICAgICAgQXJyYXkucHJvdG90eXBlLmZvckVhY2guY2FsbChzdWJNZW51LmNoaWxkcmVuLCAobm9kZSkgPT4ge1xuICAgICAgICAgICAgbm9kZS5zZXRBdHRyaWJ1dGUoJ2xhYmVsJywgbGFiZWwpO1xuICAgICAgICB9KTtcblxuICAgICAgICBpdGVtLmFwcGVuZENoaWxkKHN1Yk1lbnUpO1xuXG4gICAgICAgIGl0ZW0uYWRkRXZlbnRMaXN0ZW5lcignY2xpY2snLCBldmVudEhhbmRsZXIpO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIGNyZWF0ZXMgYSB3aW5kb3cgbWFuYWdlciB0byBoYW5kbGUgd2luZG93cyBvbiB0aGUgZGVza3RvcC5cbiAgICAgKiBAcGFyYW0gd2luZG93U3BhY2Uge0hUTUxFbGVtZW50fSB0aGUgc3BhY2Ugd2hlcmUgdGhlIHdpbmRvd3MgbGl2ZVxuICAgICAqIEByZXR1cm5zIHt7Y3JlYXRlV2luZG93OiBjcmVhdGVXaW5kb3csIG9wZW5XaW5kb3dzOiBvcGVuV2luZG93cywgZXhwYW5kOiBleHBhbmQsIG1pbmltaXplOiBtaW5pbWl6ZSwgY2xvc2U6IGNsb3NlfX0gYW5cbiAgICAgKiBvYmplY3Qgd2l0aCBtZXRob2RzIHRvIGV4cGFuZCwgbWluaW1pemUsIGNsb3NlIGFsbCwgb3BlbiBuZXcsIGFuZCBnZXQgb3BlbiB3aW5kb3dzIG9mIGEgY2VydGFpbiB0eXBlLlxuICAgICAqL1xuICAgIHN0YXRpYyB3aW5kb3dNYW5hZ2VyKHdpbmRvd1NwYWNlKSB7XG4gICAgICAgIC8va2VlcCB0cmFjayBvZiB0aGUgd2luZG93IHNwYWNlXG4gICAgICAgIGxldCB3bSA9IHtcbiAgICAgICAgICAgIHN0YXJ0WDogd2luZG93U3BhY2Uub2Zmc2V0TGVmdCArIDIwLFxuICAgICAgICAgICAgc3RhcnRZOiB3aW5kb3dTcGFjZS5vZmZzZXRUb3AgKyAyMCxcbiAgICAgICAgICAgIHR5cGVzOiAwXG4gICAgICAgIH07XG5cbiAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICAgIC8qKlxuICAgICAgICAgICAgICogQ3JlYXRlcyBhIG5ldyB3aW5kb3cgYW5kIG9wZW5zIGl0IGluIHRoZSB3aW5kb3cgc3BhY2UuXG4gICAgICAgICAgICAgKiBAcGFyYW0gdHlwZSB7c3RyaW5nfSB0aGUgbmFtZSBvZiB0aGUgaHRtbC1lbGVtZW50IHRvIGNyZWF0ZS5cbiAgICAgICAgICAgICAqIEByZXR1cm5zIHtIVE1MRWxlbWVudH0gdGhlIG5ld2x5IGNyZWF0ZWQgd2luZG93XG4gICAgICAgICAgICAgKi9cbiAgICAgICAgICAgIGNyZWF0ZVdpbmRvdzogZnVuY3Rpb24gKHR5cGUpIHtcbiAgICAgICAgICAgICAgICBsZXQgYVdpbmRvdztcbiAgICAgICAgICAgICAgICAvL2JlY2F1c2Ugb2YgYSBmaWdodCBJIGhhdmUgd2l0aCBicm93c2VyaWZ5IHRoZXNlIGRvIG5vdCBsb2FkIGR5bmFtaWNhbGx5IGhlcmUsIGJ1dCBpZiB5b3UgbG9vayBhdFxuICAgICAgICAgICAgICAgIC8vdGhldWdnbGEuZ2l0aHViLmlvL2Rlc2t0b3Avc291cmNlIHRoZXkgZG8gOi0pXG4gICAgICAgICAgICAgICAgLyppZiAoIXdtW3R5cGVdKSB7XG4gICAgICAgICAgICAgICAgICAgIGxldCBsaW5rVGVtcGxhdGUgPSBkb2N1bWVudC5xdWVyeVNlbGVjdG9yKFwiI2xpbmtUZW1wbGF0ZVwiKTtcbiAgICAgICAgICAgICAgICAgICAgbGV0IGxpbmsgPSBkb2N1bWVudC5pbXBvcnROb2RlKGxpbmtUZW1wbGF0ZS5jb250ZW50LmZpcnN0RWxlbWVudENoaWxkLCB0cnVlKTtcbiAgICAgICAgICAgICAgICAgICAgbGluay5ocmVmID0gXCIvXCIgKyB0eXBlICsgXCIuaHRtbFwiO1xuICAgICAgICAgICAgICAgICAgICBkb2N1bWVudC5oZWFkLmFwcGVuZENoaWxkKGxpbmspO1xuICAgICAgICAgICAgICAgIH0qL1xuXG4gICAgICAgICAgICAgICAgYVdpbmRvdyA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQodHlwZSk7XG5cbiAgICAgICAgICAgICAgICAvL2ltcG9ydCBwaWN0dXJlcyBmb3IgdGhlIGltYWdlIGdhbGxlcnlcbiAgICAgICAgICAgICAgICBpZiAodHlwZSA9PT0gJ2ltYWdlLWdhbGxlcnktYXBwJykge1xuICAgICAgICAgICAgICAgICAgICBpZiAoZG9jdW1lbnQucXVlcnlTZWxlY3RvcignI3BpY3R1cmVzJykpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGFXaW5kb3cuYXBwZW5kQ2hpbGQoZG9jdW1lbnQuaW1wb3J0Tm9kZShkb2N1bWVudC5xdWVyeVNlbGVjdG9yKCcjcGljdHVyZXMnKS5jb250ZW50LCB0cnVlKSk7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICB3aW5kb3dTcGFjZS5hcHBlbmRDaGlsZChhV2luZG93KTtcbiAgICAgICAgICAgICAgICBzZXR1cFNwYWNlKHR5cGUsIGFXaW5kb3cpO1xuXG4gICAgICAgICAgICAgICAgLy9rZWVwIHRyYWNrIG9mIHRoZSBvcGVuIHdpbmRvd3NcbiAgICAgICAgICAgICAgICBpZiAod21bdHlwZV0ub3Blbikge1xuICAgICAgICAgICAgICAgICAgICB3bVt0eXBlXS5vcGVuLnB1c2goYVdpbmRvdyk7XG4gICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgd21bdHlwZV0ub3BlbiA9IFthV2luZG93XTtcbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICByZXR1cm4gYVdpbmRvdztcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAvKipcbiAgICAgICAgICAgICAqIEdldHMgdGhlIG9wZW4gd2luZG93cyBvZiBhIHR5cGUuXG4gICAgICAgICAgICAgKiBAcGFyYW0gdHlwZSB7c3RyaW5nfSB0aGUgbmFtZSBvZiB0aGUgaHRtbC1lbGVtZW50IHRvIGNoZWNrIGZvci5cbiAgICAgICAgICAgICAqIEByZXR1cm5zIHtbSFRNTEVsZW1lbnRdfSBhIG5vZGUgbGlzdCBvZiB0aGUgb3BlbiB3aW5kb3dzIG9mIHRoZSB0eXBlLlxuICAgICAgICAgICAgICovXG4gICAgICAgICAgICBvcGVuV2luZG93czogZnVuY3Rpb24gKHR5cGUpIHtcbiAgICAgICAgICAgICAgICBpZiAod21bdHlwZV0pIHtcbiAgICAgICAgICAgICAgICAgICAgbGV0IHJlc3VsdCA9IFtdO1xuICAgICAgICAgICAgICAgICAgICBsZXQgd2luZG93cyA9IHdtW3R5cGVdLm9wZW47XG4gICAgICAgICAgICAgICAgICAgIC8vZmlsdGVyIG91dCB0aGUgb25lJ3MgdGhhdCdzIGJlZW4gY2xvc2VkIHNpbmNlIHRoZSBsYXN0IHRpbWVcbiAgICAgICAgICAgICAgICAgICAgcmVzdWx0ID0gd2luZG93cy5maWx0ZXIoKHcpID0+IHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybiB3Lm9wZW47XG4gICAgICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgICAgICB3bVt0eXBlXS5vcGVuID0gcmVzdWx0O1xuICAgICAgICAgICAgICAgICAgICByZXR1cm4gcmVzdWx0O1xuICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiAwOyAvL2lmIG5vIHdpbmRvd3MgYXJlIG9wZW5cbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9LFxuICAgICAgICAgICAgLyoqXG4gICAgICAgICAgICAgKiBFeHBhbmRzIGFsbCBtaW5pbWl6ZWQgd2luZG93cyBvZiBhIHR5cGUuXG4gICAgICAgICAgICAgKiBAcGFyYW0gdHlwZSB7c3RyaW5nfSB0aGUgbmFtZSBvZiB0aGUgaHRtbC1lbGVtZW50IHRvIGV4cGFuZC5cbiAgICAgICAgICAgICAqL1xuICAgICAgICAgICAgZXhwYW5kOiBmdW5jdGlvbiAodHlwZSkge1xuICAgICAgICAgICAgICAgIGxldCB3aW5zID0gdGhpcy5vcGVuV2luZG93cyh0eXBlKTtcbiAgICAgICAgICAgICAgICBpZiAod2lucykge1xuICAgICAgICAgICAgICAgICAgICB3aW5zLmZvckVhY2goKHcpID0+IHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHcubWluaW1pemVkID0gZmFsc2U7XG4gICAgICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAvKipcbiAgICAgICAgICAgICAqIE1pbmltaXplcyBhbGwgb3BlbiB3aW5kb3dzIG9mIGEgdHlwZS5cbiAgICAgICAgICAgICAqIEBwYXJhbSB0eXBlIHtzdHJpbmd9IHRoZSBuYW1lIG9mIHRoZSBodG1sLWVsZW1lbnQgdG8gbWluaW1pemUuXG4gICAgICAgICAgICAgKi9cbiAgICAgICAgICAgIG1pbmltaXplOiBmdW5jdGlvbiAodHlwZSkge1xuICAgICAgICAgICAgICAgIGxldCB3aW5zID0gdGhpcy5vcGVuV2luZG93cyh0eXBlKTtcbiAgICAgICAgICAgICAgICBpZiAod2lucykge1xuICAgICAgICAgICAgICAgICAgICB3aW5zLmZvckVhY2goKHcpID0+IHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHcubWluaW1pemVkID0gdHJ1ZTtcbiAgICAgICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIC8qKlxuICAgICAgICAgICAgICogQ2xvc2VzIGFsbCBvcGVuIHdpbmRvd3Mgb2YgYSB0eXBlLlxuICAgICAgICAgICAgICogQHBhcmFtIHR5cGUge3N0cmluZ30gdGhlIG5hbWUgb2YgdGhlIGh0bWwtZWxlbWVudCB0byBjbG9zZS5cbiAgICAgICAgICAgICAqL1xuICAgICAgICAgICAgY2xvc2U6IGZ1bmN0aW9uICh0eXBlKSB7XG4gICAgICAgICAgICAgICAgbGV0IHdpbnMgPSB0aGlzLm9wZW5XaW5kb3dzKHR5cGUpO1xuICAgICAgICAgICAgICAgIGlmICh3aW5zKSB7XG4gICAgICAgICAgICAgICAgICAgIGNvbnNvbGUubG9nKHdpbnMpO1xuICAgICAgICAgICAgICAgICAgICB3aW5zLmZvckVhY2goKHcpID0+IHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHcuY2xvc2UoKTtcbiAgICAgICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICB9O1xuXG4gICAgICAgIC8vaGVscGVyIGZ1bmN0aW9uc1xuICAgICAgICAvLyBrZWVwcyB0cmFjayBvZiB0aGUgd2luZG93IHNwYWNlIHNvIHRoZSB3aW5kb3dzIGRvbid0IGFsbFxuICAgICAgICAvL29wZW4gb24gdG9wIG9mIGVhY2ggb3RoZXIsIGFuZCBkb2Vzbid0IGRpc2FwcGVhciBvdXRcbiAgICAgICAgLy9vZiB0aGUgc3BhY2VcbiAgICAgICAgZnVuY3Rpb24gc2V0dXBTcGFjZSh0eXBlLCBzcGFjZSkge1xuICAgICAgICAgICAgbGV0IGRlc3RpbmF0aW9uID0ge307XG4gICAgICAgICAgICBsZXQgeDtcbiAgICAgICAgICAgIGxldCB5O1xuXG4gICAgICAgICAgICBpZiAod21bdHlwZV0pIHsgLy90aGUgdHlwZSBhbHJlYWR5IGV4aXN0c1xuICAgICAgICAgICAgICAgIGRlc3RpbmF0aW9uLnggPSAod21bdHlwZV0ubGF0ZXN0Q29vcmRzLnggKz0gNTApOyAgLy9jcmVhdGUgYSBuZXcgc3BhY2UgdG8gb3BlbiB0aGUgd2luZG93XG4gICAgICAgICAgICAgICAgZGVzdGluYXRpb24ueSA9ICh3bVt0eXBlXS5sYXRlc3RDb29yZHMueSArPSA1MCk7XG5cbiAgICAgICAgICAgICAgICBpZiAoISh3aXRoaW5Cb3VuZHMoc3BhY2UsIHdpbmRvd1NwYWNlLCBkZXN0aW5hdGlvbikpKSB7IC8vY2hlY2sgdGhhdCB0aGUgc3BhY2UgaXMgd2l0aGluIGJvdW5kc1xuICAgICAgICAgICAgICAgICAgICB4ID0gd21bdHlwZV0uc3RhcnRDb29yZHMueCArPSA1O1xuICAgICAgICAgICAgICAgICAgICB5ID0gd21bdHlwZV0uc3RhcnRDb29yZHMueSArPSA1O1xuICAgICAgICAgICAgICAgICAgICB3bVt0eXBlXS5sYXRlc3RDb29yZHMueCA9IHg7XG4gICAgICAgICAgICAgICAgICAgIHdtW3R5cGVdLmxhdGVzdENvb3Jkcy55ID0geTtcbiAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICB4ID0gZGVzdGluYXRpb24ueDtcbiAgICAgICAgICAgICAgICAgICAgeSA9IGRlc3RpbmF0aW9uLnk7XG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICB9IGVsc2UgeyAvL2NyZWF0ZSBhIHN0YXJ0aW5nIHBvaW50IGZvciB0aGUgd2luZG93cyBvZiB0aGlzIHR5cGVcbiAgICAgICAgICAgICAgICBkZXN0aW5hdGlvbi54ID0gKHdtLnN0YXJ0WCArICg2MCAqIHdtLnR5cGVzKSk7XG4gICAgICAgICAgICAgICAgZGVzdGluYXRpb24ueSA9ICh3bS5zdGFydFkpO1xuXG4gICAgICAgICAgICAgICAgaWYgKCEod2l0aGluQm91bmRzKHNwYWNlLCB3aW5kb3dTcGFjZSwgZGVzdGluYXRpb24pKSkge1xuICAgICAgICAgICAgICAgICAgICB4ID0gd20uc3RhcnRYO1xuICAgICAgICAgICAgICAgICAgICB5ID0gd20uc3RhcnRZO1xuICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgIHggPSBkZXN0aW5hdGlvbi54O1xuICAgICAgICAgICAgICAgICAgICB5ID0gZGVzdGluYXRpb24ueTtcbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICB3bVt0eXBlXSA9IHt9O1xuICAgICAgICAgICAgICAgIHdtW3R5cGVdLnN0YXJ0Q29vcmRzID0ge1xuICAgICAgICAgICAgICAgICAgICB4OiB4LFxuICAgICAgICAgICAgICAgICAgICB5OiB5XG4gICAgICAgICAgICAgICAgfTtcbiAgICAgICAgICAgICAgICB3bVt0eXBlXS5sYXRlc3RDb29yZHMgPSB7XG4gICAgICAgICAgICAgICAgICAgIHg6IHgsXG4gICAgICAgICAgICAgICAgICAgIHk6IHlcbiAgICAgICAgICAgICAgICB9O1xuICAgICAgICAgICAgICAgIHdtLnR5cGVzICs9IDE7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBzcGFjZS50YWJJbmRleCA9IDA7XG4gICAgICAgICAgICBzcGFjZS5zdHlsZS50b3AgPSB5ICsgXCJweFwiO1xuICAgICAgICAgICAgc3BhY2Uuc3R5bGUubGVmdCA9IHggKyBcInB4XCI7XG4gICAgICAgIH1cblxuICAgICAgICAvL2NoZWNrcyBpZiBhIHNwYWNlIGlzIHdpdGhpbiBib3VuZHNcbiAgICAgICAgZnVuY3Rpb24gd2l0aGluQm91bmRzKGVsZW1lbnQsIGNvbnRhaW5lciwgY29vcmRzKSB7XG4gICAgICAgICAgICBsZXQgbWluWCA9IGNvbnRhaW5lci5vZmZzZXRMZWZ0O1xuICAgICAgICAgICAgbGV0IG1heFggPSAobWluWCArIGNvbnRhaW5lci5jbGllbnRXaWR0aCkgLSAoZWxlbWVudC5nZXRCb3VuZGluZ0NsaWVudFJlY3QoKS53aWR0aCk7XG4gICAgICAgICAgICBsZXQgbWluWSA9IGNvbnRhaW5lci5vZmZzZXRUb3A7XG4gICAgICAgICAgICBsZXQgbWF4WSA9IChtaW5ZICsgY29udGFpbmVyLmNsaWVudEhlaWdodCkgLSAoZWxlbWVudC5nZXRCb3VuZGluZ0NsaWVudFJlY3QoKS5oZWlnaHQpO1xuXG4gICAgICAgICAgICByZXR1cm4gKGNvb3Jkcy54IDw9IG1heFggJiYgY29vcmRzLnggPj0gbWluWCAmJiBjb29yZHMueSA8PSBtYXhZICYmIGNvb3Jkcy55ID49IG1pblkpO1xuICAgICAgICB9XG4gICAgfVxufVxuXG5cbi8vaGVscGVyIGZ1bmN0aW9uIHRvIGFkZCBtb3JlIHRoYW4gb25lIGV2ZW50IHR5cGUgZm9yIGVhY2ggZWxlbWVudCBhbmQgaGFuZGxlclxuZnVuY3Rpb24gYWRkRXZlbnRMaXN0ZW5lcnMgKGVsZW1lbnQsIGV2ZW50cywgaGFuZGxlcikge1xuICAgIGV2ZW50cy5zcGxpdCgnICcpLmZvckVhY2goZXZlbnQgPT4gZWxlbWVudC5hZGRFdmVudExpc3RlbmVyKGV2ZW50LCBoYW5kbGVyKSk7XG59XG5cbi8vZXhwb3J0XG5tb2R1bGUuZXhwb3J0cyA9IERlc2t0b3A7XG4iLCIvKlxuKiBBIG1vZHVsZSBmb3IgYSBjdXN0b20gSFRNTCBlbGVtZW50IGRyYWdnYWJsZS13aW5kb3cgdG8gZm9ybSBwYXJ0IG9mIGEgd2ViIGNvbXBvbmVudC5cbiogSXQgY3JlYXRlcyBhIHdpbmRvdyB0aGF0IGNhbiBiZSBtb3ZlZCBhY3Jvc3MgdGhlIHNjcmVlbiwgY2xvc2VkIGFuZCBtaW5pbWl6ZWQuXG4qIEBhdXRob3IgTW9sbHkgQXJoYW1tYXJcbiogQHZlcnNpb24gMS4wLjBcbipcbiovXG5cbmNsYXNzIERyYWdnYWJsZVdpbmRvdyBleHRlbmRzIEhUTUxFbGVtZW50IHtcbiAgICAvKipcbiAgICAgKiBJbml0aWF0ZXMgYSBkcmFnZ2FibGUtd2luZG93LCBzZXRzIHVwIHNoYWRvdyBET00uXG4gICAgICovXG4gICAgY29uc3RydWN0b3IoKSB7XG4gICAgICAgIHN1cGVyKCk7XG4gICAgICAgIGxldCB3aW5kb3dUZW1wbGF0ZSA9IGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3IoJ2xpbmtbaHJlZj1cIi9kcmFnZ2FibGUtd2luZG93Lmh0bWxcIl0nKS5pbXBvcnQucXVlcnlTZWxlY3RvcihcIiN3aW5kb3dUZW1wbGF0ZVwiKTsgLy9zaGFkb3cgRE9NIGltcG9ydFxuXG4gICAgICAgIC8vc2V0dXAgc2hhZG93IGRvbSBzdHlsZXNcbiAgICAgICAgbGV0IHNoYWRvd1Jvb3QgPSB0aGlzLmF0dGFjaFNoYWRvdyh7bW9kZTogXCJvcGVuXCIsIGRlbGVnYXRlc0ZvY3VzOiB0cnVlfSk7XG4gICAgICAgIGxldCBpbnN0YW5jZSA9IHdpbmRvd1RlbXBsYXRlLmNvbnRlbnQuY2xvbmVOb2RlKHRydWUpO1xuICAgICAgICBzaGFkb3dSb290LmFwcGVuZENoaWxkKGluc3RhbmNlKTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBSdW5zIHdoZW4gd2luZG93IGlzIGluc2VydGVkIGludG8gdGhlIERPTS5cbiAgICAgKiBTZXRzIHVwIGV2ZW50IGxpc3RlbmVycyBhbmQgYmVoYXZpb3VyIG9mIHRoZSB3aW5kb3cuXG4gICAgICovXG4gICAgY29ubmVjdGVkQ2FsbGJhY2soKSB7XG5cbiAgICAgICAgLy9zZXQgYmVoYXZpb3VyXG4gICAgICAgIG1ha2VEcmFnZ2FibGUodGhpcywgdGhpcy5wYXJlbnROb2RlKTtcblxuICAgICAgICAvL2FkZCBldmVudCBsaXN0ZW5lcnNcbiAgICAgICAgdGhpcy5hZGRFdmVudExpc3RlbmVyKFwiY2xpY2tcIiwgKGV2ZW50KSA9PiB7XG4gICAgICAgICAgICBsZXQgdGFyZ2V0ID0gZXZlbnQuY29tcG9zZWRQYXRoKClbMF07IC8vZm9sbG93IHRoZSB0cmFpbCB0aHJvdWdoIHNoYWRvdyBET01cbiAgICAgICAgICAgIGxldCBpZCA9IHRhcmdldC5nZXRBdHRyaWJ1dGUoXCJpZFwiKTtcbiAgICAgICAgICAgIGlmIChpZCA9PT0gXCJjbG9zZVwiKSB7XG4gICAgICAgICAgICAgICAgdGhpcy5jbG9zZSgpO1xuICAgICAgICAgICAgfSBlbHNlIGlmIChpZCA9PT0gXCJtaW5pbWl6ZVwiKSB7XG4gICAgICAgICAgICAgICAgdGhpcy5taW5pbWl6ZWQgPSB0cnVlO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgaWYgKGV2ZW50LnR5cGUgPT09ICdjbGljaycpIHsgLy9tYWtlIHdvcmsgd2l0aCB0b3VjaCBldmVudHNcbiAgICAgICAgICAgICAgICBldmVudC5wcmV2ZW50RGVmYXVsdCgpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9KTtcblxuICAgICAgICB0aGlzLm9wZW4gPSB0cnVlO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFNldHMgdXAgd2hhdCBhdHRyaWJ1dGUtY2hhbmdlcyB0byB3YXRjaCBmb3IgaW4gdGhlIERPTS5cbiAgICAgKiBAcmV0dXJucyB7W3N0cmluZ119IGFuIGFycmF5IG9mIHRoZSBuYW1lcyBvZiB0aGUgYXR0cmlidXRlcyB0byB3YXRjaC5cbiAgICAgKi9cbiAgICBzdGF0aWMgZ2V0IG9ic2VydmVkQXR0cmlidXRlcygpIHtcbiAgICAgICAgcmV0dXJuIFsnb3BlbiddO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFdhdGNoZXMgZm9yIGF0dHJpYnV0ZSBjaGFuZ2VzIGluIHRoZSBET00gYWNjb3JkaW5nIHRvIG9ic2VydmVkQXR0cmlidXRlcygpXG4gICAgICogQHBhcmFtIG5hbWUgdGhlIG5hbWUgb2YgdGhlIGF0dHJpYnV0ZVxuICAgICAqIEBwYXJhbSBvbGRWYWx1ZSB0aGUgb2xkIHZhbHVlXG4gICAgICogQHBhcmFtIG5ld1ZhbHVlIHRoZSBuZXcgdmFsdWVcbiAgICAgKi9cbiAgICBhdHRyaWJ1dGVDaGFuZ2VkQ2FsbGJhY2sobmFtZSwgb2xkVmFsdWUsIG5ld1ZhbHVlKSB7XG4gICAgICAgIGlmICghdGhpcy5vcGVuKSB7XG4gICAgICAgICAgICB0aGlzLmNsb3NlKCk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBAcmV0dXJucyB7Ym9vbGVhbn0gdHJ1ZSBpZiB0aGUgd2luZG93IGhhcyBhdHRyaWJ1dGUgJ29wZW4nXG4gICAgICovXG4gICAgZ2V0IG9wZW4oKSB7XG4gICAgICAgIHJldHVybiB0aGlzLmhhc0F0dHJpYnV0ZSgnb3BlbicpO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFNldHMgdGhlICdvcGVuJyBhdHRyaWJ1dGUgb24gdGhlIHdpbmRvdy5cbiAgICAgKiBAcGFyYW0gb3BlbiB7Ym9vbGVhbn0gd2hldGhlciB0byBhZGQgb3IgcmVtb3ZlIHRoZSAnb3BlbicgYXR0cmlidXRlXG4gICAgICovXG4gICAgc2V0IG9wZW4ob3Blbikge1xuICAgICAgICBpZiAob3Blbikge1xuICAgICAgICAgICAgdGhpcy5zZXRBdHRyaWJ1dGUoJ29wZW4nLCAnJyk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICB0aGlzLnJlbW92ZUF0dHJpYnV0ZSgnb3BlbicpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogQHJldHVybnMge2Jvb2xlYW59IHRydWUgaWYgdGhlIHdpbmRvdyBoYXMgYXR0cmlidXRlICdtaW5pbWl6ZWQnXG4gICAgICovXG4gICAgZ2V0IG1pbmltaXplZCgpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuaGFzQXR0cmlidXRlKCdtaW5pbWl6ZWQnKTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBTZXRzIHRoZSAnbWluaW1pemVkJyBhdHRyaWJ1dGUgb24gdGhlIHdpbmRvdy5cbiAgICAgKiBAcGFyYW0gbWluaW1pemUge2Jvb2xlYW59IHdoZXRoZXIgdG8gYWRkIG9yIHJlbW92ZSB0aGUgJ21pbmltaXplZCcgYXR0cmlidXRlXG4gICAgICovXG4gICAgc2V0IG1pbmltaXplZChtaW5pbWl6ZSkge1xuICAgICAgICBpZiAobWluaW1pemUpIHtcbiAgICAgICAgICAgIHRoaXMuc2V0QXR0cmlidXRlKCdtaW5pbWl6ZWQnLCAnJyk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICB0aGlzLnJlbW92ZUF0dHJpYnV0ZSgnbWluaW1pemVkJyk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBDbG9zZXMgdGhlIHdpbmRvdy4gUmVtb3ZlcyBpdCBmcm9tIHRoZSBET00gYW5kIHNldHMgYWxsIGF0dHJpYnV0ZXMgdG8gZmFsc2UuXG4gICAgICovXG4gICAgY2xvc2UoKSB7XG4gICAgICAgIGlmICh0aGlzLm9wZW4pIHtcbiAgICAgICAgICAgIHRoaXMub3BlbiA9IGZhbHNlO1xuICAgICAgICAgICAgdGhpcy5taW5pbWl6ZWQgPSBmYWxzZTtcbiAgICAgICAgICAgIGlmICh0aGlzLnBhcmVudEVsZW1lbnQpIHtcbiAgICAgICAgICAgICAgICB0aGlzLnBhcmVudE5vZGUucmVtb3ZlQ2hpbGQodGhpcyk7XG4gICAgICAgICAgICB9IGVsc2UgaWYgKHRoaXMucGFyZW50Tm9kZS5ob3N0ICYmIHRoaXMucGFyZW50Tm9kZS5ob3N0LnBhcmVudE5vZGUpIHsgLy90aGlzIGlzIHBhcnQgb2YgYSBzaGFkb3cgZG9tXG4gICAgICAgICAgICAgICAgdGhpcy5wYXJlbnROb2RlLmhvc3QucGFyZW50Tm9kZS5yZW1vdmVDaGlsZCh0aGlzLnBhcmVudE5vZGUuaG9zdCk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9XG5cbn1cblxuLy9oZWxwZXIgZnVuY3Rpb25cbi8vbWFrZXMgYW4gZWxlbWVudCBkcmFnZ2FibGUgd2l0aCAgbW91c2UsIGFycm93cyBhbmQgdG91Y2hcbmZ1bmN0aW9uIG1ha2VEcmFnZ2FibGUoZWwpIHtcbiAgICBsZXQgYXJyb3dEcmFnO1xuICAgIGxldCBtb3VzZURyYWc7XG4gICAgbGV0IGRyYWdvZmZzZXQgPSB7IC8vdG8gbWFrZSB0aGUgZHJhZyBub3QganVtcCBmcm9tIHRoZSBjb3JuZXJcbiAgICAgICAgeDogMCxcbiAgICAgICAgeTogMFxuICAgIH07XG5cbiAgICBsZXQgZXZlbnRzID0gZnVuY3Rpb24oKSB7XG4gICAgICAgIGFkZEV2ZW50TGlzdGVuZXJzKGVsLCAnZm9jdXNpbiBtb3VzZWRvd24nLCAoKGV2ZW50KSA9PiB7XG4gICAgICAgICAgICBsZXQgdGFyZ2V0ID0gZXZlbnQ7XG4gICAgICAgICAgICBhcnJvd0RyYWcgPSB0cnVlO1xuICAgICAgICAgICAgaWYgKGV2ZW50LnR5cGUgPT09ICdtb3VzZWRvd24nKSB7XG4gICAgICAgICAgICAgICAgbW91c2VEcmFnID0gdHJ1ZTtcbiAgICAgICAgICAgICAgICBkcmFnb2Zmc2V0LnggPSB0YXJnZXQucGFnZVggLSBlbC5vZmZzZXRMZWZ0O1xuICAgICAgICAgICAgICAgIGRyYWdvZmZzZXQueSA9IHRhcmdldC5wYWdlWSAtIGVsLm9mZnNldFRvcDtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSkpO1xuICAgICAgICBhZGRFdmVudExpc3RlbmVycyhlbCwgJ2ZvY3Vzb3V0IG1vdXNldXAnLCAoKGV2ZW50KSA9PiB7XG4gICAgICAgICAgICBpZiAoZXZlbnQudHlwZSA9PT0gJ21vdXNldXAnKSB7XG4gICAgICAgICAgICAgICAgaWYgKG1vdXNlRHJhZykge1xuICAgICAgICAgICAgICAgICAgICBtb3VzZURyYWcgPSBmYWxzZTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIGFycm93RHJhZyA9IGZhbHNlO1xuICAgICAgICAgICAgfVxuICAgICAgICB9KSk7XG4gICAgICAgIGFkZEV2ZW50TGlzdGVuZXJzKGRvY3VtZW50LCAnbW91c2Vtb3ZlIGtleWRvd24nLCAoKGV2ZW50KSA9PiB7XG4gICAgICAgICAgICBsZXQgZGVzdGluYXRpb24gPSB7fTsgLy9hcyB0byBub3Qga2VlcCBwb2xsaW5nIHRoZSBET01cblxuICAgICAgICAgICAgaWYgKG1vdXNlRHJhZykge1xuICAgICAgICAgICAgICAgIGRlc3RpbmF0aW9uLnkgPSAoZXZlbnQucGFnZVkgLSBkcmFnb2Zmc2V0LnkpO1xuICAgICAgICAgICAgICAgIGRlc3RpbmF0aW9uLnggPSAoZXZlbnQucGFnZVggLSBkcmFnb2Zmc2V0LngpO1xuICAgICAgICAgICAgfSBlbHNlIGlmIChhcnJvd0RyYWcpIHtcbiAgICAgICAgICAgICAgICBkZXN0aW5hdGlvbi55ID0gcGFyc2VJbnQoZWwuc3R5bGUudG9wLnNsaWNlKDAsIC0yKSk7XG4gICAgICAgICAgICAgICAgZGVzdGluYXRpb24ueCA9IHBhcnNlSW50KGVsLnN0eWxlLmxlZnQuc2xpY2UoMCwgLTIpKTtcblxuICAgICAgICAgICAgICAgIHN3aXRjaCAoZXZlbnQua2V5KSB7XG4gICAgICAgICAgICAgICAgICAgIGNhc2UgJ0Fycm93VXAnOlxuICAgICAgICAgICAgICAgICAgICAgICAgZGVzdGluYXRpb24ueSAtPSA1O1xuICAgICAgICAgICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICAgICAgICAgIGNhc2UgJ0Fycm93RG93bic6XG4gICAgICAgICAgICAgICAgICAgICAgICBkZXN0aW5hdGlvbi55ICs9IDU7XG4gICAgICAgICAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgICAgICAgICAgY2FzZSAnQXJyb3dMZWZ0JzpcbiAgICAgICAgICAgICAgICAgICAgICAgIGRlc3RpbmF0aW9uLnggLT0gNTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgICAgICAgICBjYXNlICdBcnJvd1JpZ2h0JzpcbiAgICAgICAgICAgICAgICAgICAgICAgIGRlc3RpbmF0aW9uLnggKz0gNTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgaWYgKG1vdXNlRHJhZyB8fCBhcnJvd0RyYWcpIHtcbiAgICAgICAgICAgICAgICBlbC5zdHlsZS5sZWZ0ID0gZGVzdGluYXRpb24ueCAgKyBcInB4XCI7XG4gICAgICAgICAgICAgICAgZWwuc3R5bGUudG9wID0gZGVzdGluYXRpb24ueSAgKyBcInB4XCI7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgfSkpO1xuICAgIH07XG5cbiAgICAvL2luaXRpYXRlIGEgbW91c2UgZXZlbnQgZnJvbSB0aGUgdG91Y2hcbiAgICBmdW5jdGlvbiB0b3VjaEhhbmRsZXIoZXZlbnQpIHtcbiAgICAgICAgaWYgKGV2ZW50LnRhcmdldC5hc3NpZ25lZFNsb3QgJiYgZXZlbnQudGFyZ2V0LmFzc2lnbmVkU2xvdC5uYW1lID09PSAndGl0bGUnKSB7IC8vb25seSBkcmFnIGZyb20gdGhlIHRpdGxlIGJhciBvbiB0b3VjaCwgYXMgdG8gbm90IGludGVycnVwdCBzY3JvbGxpbmdcbiAgICAgICAgICAgIGxldCB0b3VjaGVzID0gZXZlbnQuY2hhbmdlZFRvdWNoZXM7XG4gICAgICAgICAgICBsZXQgZmlyc3QgPSB0b3VjaGVzWzBdO1xuICAgICAgICAgICAgbGV0IHR5cGUgPSBcIlwiO1xuXG4gICAgICAgICAgICBzd2l0Y2ggKGV2ZW50LnR5cGUpIHtcbiAgICAgICAgICAgICAgICBjYXNlIFwidG91Y2hzdGFydFwiOlxuICAgICAgICAgICAgICAgICAgICB0eXBlID0gXCJtb3VzZWRvd25cIjtcbiAgICAgICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICAgICAgY2FzZSBcInRvdWNobW92ZVwiOlxuICAgICAgICAgICAgICAgICAgICB0eXBlID0gXCJtb3VzZW1vdmVcIjtcbiAgICAgICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICAgICAgY2FzZSBcInRvdWNoZW5kXCI6XG4gICAgICAgICAgICAgICAgICAgIHR5cGUgPSBcIm1vdXNldXBcIjtcbiAgICAgICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICAgICAgZGVmYXVsdDpcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAvL3NldCB1cCB0aGUgZXZlbnRcbiAgICAgICAgICAgIGxldCBzaW11bGF0ZWRFdmVudCA9IG5ldyBNb3VzZUV2ZW50KHR5cGUsIHtcbiAgICAgICAgICAgICAgICBzY3JlZW5YOiBmaXJzdC5zY3JlZW5YLFxuICAgICAgICAgICAgICAgIHNjcmVlblk6IGZpcnN0LnNjcmVlblksXG4gICAgICAgICAgICAgICAgY2xpZW50WDogZmlyc3QuY2xpZW50WCxcbiAgICAgICAgICAgICAgICBjbGllbnRZOiBmaXJzdC5jbGllbnRZLFxuICAgICAgICAgICAgICAgIGJ1dHRvbjogMSxcbiAgICAgICAgICAgICAgICBidWJibGVzOiB0cnVlXG5cbiAgICAgICAgICAgIH0pO1xuXG4gICAgICAgICAgICBlbC5kaXNwYXRjaEV2ZW50KHNpbXVsYXRlZEV2ZW50KTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIGZ1bmN0aW9uIHRvdWNoZXZlbnRzKCkge1xuICAgICAgICBlbC5hZGRFdmVudExpc3RlbmVyKFwidG91Y2hzdGFydFwiLCB0b3VjaEhhbmRsZXIsIHRydWUpO1xuICAgICAgICBkb2N1bWVudC5hZGRFdmVudExpc3RlbmVyKFwidG91Y2htb3ZlXCIsIHRvdWNoSGFuZGxlciwgdHJ1ZSk7XG4gICAgICAgIGVsLmFkZEV2ZW50TGlzdGVuZXIoXCJ0b3VjaGVuZFwiLCB0b3VjaEhhbmRsZXIsIHRydWUpO1xuICAgICAgICBkb2N1bWVudC5hZGRFdmVudExpc3RlbmVyKFwidG91Y2hjYW5jZWxcIiwgdG91Y2hIYW5kbGVyLCB0cnVlKTtcbiAgICB9XG5cbiAgICBldmVudHMoKTtcbiAgICB0b3VjaGV2ZW50cygpO1xufVxuXG4vL2hlbHBlciBmdW5jdGlvblxuLy9hZGRzIG11bHRpcGxlIGV2ZW50IGxpc3RlbmVycyB3aXRoIGlkZW50aWNhbCBoYW5kbGVyc1xuZnVuY3Rpb24gYWRkRXZlbnRMaXN0ZW5lcnMoZWxlbWVudCwgZXZlbnRzLCBoYW5kbGVyKSB7XG4gICAgZXZlbnRzLnNwbGl0KCcgJykuZm9yRWFjaChldmVudCA9PiBlbGVtZW50LmFkZEV2ZW50TGlzdGVuZXIoZXZlbnQsIGhhbmRsZXIpKTtcbn1cblxuLy9kZWZpbmVzIHRoZSBlbGVtZW50XG5jdXN0b21FbGVtZW50cy5kZWZpbmUoJ2RyYWdnYWJsZS13aW5kb3cnLCBEcmFnZ2FibGVXaW5kb3cpO1xuIiwiLypcbiAqIEEgbW9kdWxlIGZvciBhIGN1c3RvbSBIVE1MIGVsZW1lbnQgZXhwYW5kYWJsZS1tZW51LWl0ZW0gZm9ybSBwYXJ0IG9mIGEgd2ViIGNvbXBvbmVudC5cbiAqIEl0IGNyZWF0ZXMgYW4gaXRlbSB0aGF0IHdoZW4gY2xpY2tlZCB0b2dnbGVzIHRvIHNob3cgb3IgaGlkZSBzdWItaXRlbXMuXG4gKiBAYXV0aG9yIE1vbGx5IEFyaGFtbWFyXG4gKiBAdmVyc2lvbiAxLjAuMFxuICpcbiAqL1xuXG5jbGFzcyBFeHBhbmRhYmxlTWVudUl0ZW0gZXh0ZW5kcyBIVE1MRWxlbWVudCB7XG4gICAgLyoqXG4gICAgICogSW5pdGlhdGVzIGEgZHJhZ2dhYmxlLXdpbmRvdywgc2V0cyB1cCBzaGFkb3cgRE9NLlxuICAgICAqL1xuICAgIGNvbnN0cnVjdG9yKCkge1xuICAgICAgICBzdXBlcigpO1xuICAgICAgICBsZXQgbWVudVRlbXBsYXRlID0gZG9jdW1lbnQucXVlcnlTZWxlY3RvcignbGlua1tocmVmPVwiL2V4cGFuZGFibGUtbWVudS1pdGVtLmh0bWxcIl0nKS5pbXBvcnQucXVlcnlTZWxlY3RvcihcIiNtZW51SXRlbVRlbXBsYXRlXCIpOyAvL3NoYWRvdyBET00gaW1wb3J0XG5cbiAgICAgICAgLy9zZXQgdXAgc2hhZG93IGRvbSBzdHlsZXNcbiAgICAgICAgbGV0IHNoYWRvd1Jvb3QgPSB0aGlzLmF0dGFjaFNoYWRvdyh7bW9kZTogXCJvcGVuXCJ9KTtcbiAgICAgICAgbGV0IGluc3RhbmNlID0gbWVudVRlbXBsYXRlLmNvbnRlbnQuY2xvbmVOb2RlKHRydWUpO1xuICAgICAgICBzaGFkb3dSb290LmFwcGVuZENoaWxkKGluc3RhbmNlKTtcblxuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFJ1bnMgd2hlbiB3aW5kb3cgaXMgaW5zZXJ0ZWQgaW50byB0aGUgRE9NLlxuICAgICAqIFNldHMgdXAgZXZlbnQgbGlzdGVuZXJzIGFuZCBiZWhhdmlvdXIgb2YgdGhlIGl0ZW0uXG4gICAgICovXG4gICAgY29ubmVjdGVkQ2FsbGJhY2soKSB7XG4gICAgICAgIG1ha2VFeHBhbmRhYmxlKHRoaXMpO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIEByZXR1cm5zIHtbbm9kZV19IGFuIGFycmF5IG9mIHRoZSBzdWJpdGVtcyB0aGUgaXRlbSBoYXMgYXNzaWduZWQgaW4gdGhlIERPTS5cbiAgICAgKiBBIHN1Yml0ZW0gY291bnRzIGFzIGFuIGl0ZW0gdGhhdCBoYXMgdGhlIHNsb3Qgb2YgJ3N1Yml0ZW0nIGFuZCB0aGUgc2FtZSBsYWJlbFxuICAgICAqIGFzIHRoZSBleHBhbmRhYmxlIG1lbnUgaXRlbSBpdHNlbGYuXG4gICAgICovXG4gICAgZ2V0IHN1Yk1lbnUoKSB7XG4gICAgICAgIGxldCBsYWJlbCA9IHRoaXMuZ2V0QXR0cmlidXRlKCdsYWJlbCcpO1xuICAgICAgICByZXR1cm4gQXJyYXkucHJvdG90eXBlLmZpbHRlci5jYWxsKHRoaXMucXVlcnlTZWxlY3RvckFsbCgnW3Nsb3Q9XCJzdWJpdGVtXCJdJyksIChub2RlKSA9PiB7XG4gICAgICAgICAgICBsZXQgbm9kZUxhYmVsID0gbm9kZS5nZXRBdHRyaWJ1dGUoJ2xhYmVsJyk7XG4gICAgICAgICAgICByZXR1cm4gbm9kZUxhYmVsID09PSBsYWJlbDtcbiAgICAgICAgfSk7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogQHJldHVybnMge2Jvb2xlYW59IHRydWUgaWYgdGhlIGl0ZW0gaXMgY3VycmVudGx5IGRpc3BsYXlpbmcgdGhlIHN1Ym1lbnUtaXRlbXMuXG4gICAgICovXG4gICAgZ2V0IGRpc3BsYXlpbmdTdWJNZW51KCkge1xuICAgICAgICByZXR1cm4gIXRoaXMuc3ViTWVudVswXS5oYXNBdHRyaWJ1dGUoJ2hpZGUnKTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBTaG93cyBvciBoaWRlcyB0aGUgc3VibWVudS1pdGVtcy5cbiAgICAgKiBAcGFyYW0gc2hvdyB7Ym9vbGVhbn0gd2hldGhlciB0byBzaG93IG9yIGhpZGUuXG4gICAgICovXG4gICAgdG9nZ2xlU3ViTWVudShzaG93KSB7XG4gICAgICAgIGlmIChzaG93KSB7XG4gICAgICAgICAgICB0aGlzLnN1Yk1lbnUuZm9yRWFjaCgocG9zdCkgPT4ge1xuICAgICAgICAgICAgICAgIHBvc3QucmVtb3ZlQXR0cmlidXRlKCdoaWRlJyk7XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHRoaXMuc3ViTWVudS5mb3JFYWNoKChwb3N0KSA9PiB7XG4gICAgICAgICAgICAgICAgcG9zdC5zZXRBdHRyaWJ1dGUoJ2hpZGUnLCAnJyk7XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgfVxuXG4gICAgfVxuXG59XG5cbi8vZGVmaW5lcyB0aGUgZWxlbWVudFxuY3VzdG9tRWxlbWVudHMuZGVmaW5lKCdleHBhbmRhYmxlLW1lbnUtaXRlbScsIEV4cGFuZGFibGVNZW51SXRlbSk7XG5cbi8vaGVscGVyIGZ1bmN0aW9uIHRvIG1ha2UgdGhlIGl0ZW0gZXhwYW5kYWJsZVxuLy90YWtlcyB0aGUgaXRlbSB0byBleHBhbmQgYXMgYSBwYXJhbWV0ZXJcbmZ1bmN0aW9uIG1ha2VFeHBhbmRhYmxlKGl0ZW0pIHtcbiAgICBsZXQgbmV4dEZvY3VzID0gMDtcbiAgICBsZXQgc2hvdyA9IGZhbHNlO1xuICAgIGxldCBhcnJvd0V4cGFuZDtcbiAgICBsZXQgbW91c2VFeHBhbmQ7XG5cbiAgICBsZXQgZXZlbnRzID0gZnVuY3Rpb24gKCkge1xuICAgICAgICBhZGRFdmVudExpc3RlbmVycyhpdGVtLCAnZm9jdXNpbiBjbGljaycsICgoZXZlbnQpID0+IHtcbiAgICAgICAgICAgICAgICBhcnJvd0V4cGFuZCA9IHRydWU7XG4gICAgICAgICAgICAgICAgaWYgKGV2ZW50LnR5cGUgPT09ICdjbGljaycpIHtcbiAgICAgICAgICAgICAgICAgICAgbW91c2VFeHBhbmQgPSB0cnVlO1xuICAgICAgICAgICAgICAgICAgICBzaG93ID0gIXNob3c7XG4gICAgICAgICAgICAgICAgICAgIGl0ZW0udG9nZ2xlU3ViTWVudShzaG93KTtcbiAgICAgICAgICAgICAgICAgICAgZXZlbnQucHJldmVudERlZmF1bHQoKTtcbiAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICBpdGVtLnRvZ2dsZVN1Yk1lbnUodHJ1ZSk7XG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgIH0pKTtcbiAgICAgICAgYWRkRXZlbnRMaXN0ZW5lcnMoaXRlbSwgJ2tleWRvd24nLCAoKGV2ZW50KSA9PiB7IC8vbWFrZSB0aGUgc3ViLWl0ZW1zIHRyYXZlcnNhYmxlIGJ5IHByZXNzaW5nIHRoZSBhcnJvdyBrZXlzXG4gICAgICAgICAgICAgICAgaWYgKGFycm93RXhwYW5kKSB7XG4gICAgICAgICAgICAgICAgICAgIHN3aXRjaCAoZXZlbnQua2V5KSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBjYXNlICdBcnJvd1JpZ2h0JzpcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBpdGVtLnRvZ2dsZVN1Yk1lbnUodHJ1ZSk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICAgICAgICAgICAgICBjYXNlICdBcnJvd0xlZnQnOlxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGl0ZW0udG9nZ2xlU3ViTWVudShmYWxzZSk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICAgICAgICAgICAgICBjYXNlICdBcnJvd1VwJzpcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBpZiAoIWl0ZW0uZGlzcGxheWluZ1N1Yk1lbnUpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgaXRlbS50b2dnbGVTdWJNZW51KHRydWUpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBuZXh0Rm9jdXMgLT0gMTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBpZiAobmV4dEZvY3VzIDwgMCB8fCBuZXh0Rm9jdXMgPj0gaXRlbS5zdWJNZW51Lmxlbmd0aCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBuZXh0Rm9jdXMgPSBpdGVtLnN1Yk1lbnUubGVuZ3RoIC0xO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBpdGVtLnN1Yk1lbnVbbmV4dEZvY3VzXS5mb2N1cygpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGZvY3VzKGl0ZW0sIGl0ZW0uc3ViTWVudVtuZXh0Rm9jdXNdKTsgLy9tYWtlIGl0IGFjY2Vzc2libGUgdmlhIGNzcyB2aXN1YWwgY2x1ZXMgZXZlbiBpZiB0aGUgYWN0aXZlIGVsZW1lbnQgaXMgaGlkZGVuIHdpdGhpbiBzaGFkb3dET01cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgICAgICAgICAgICAgIGNhc2UgJ0Fycm93RG93bic6XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgaWYgKCFpdGVtLmRpc3BsYXlpbmdTdWJNZW51KSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGl0ZW0udG9nZ2xlU3ViTWVudSh0cnVlKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgbmV4dEZvY3VzICs9IDE7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgaWYgKG5leHRGb2N1cyA+PSBpdGVtLnN1Yk1lbnUubGVuZ3RoIHx8IG5leHRGb2N1cyA8IDApIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgbmV4dEZvY3VzID0gMDtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgaXRlbS5zdWJNZW51W25leHRGb2N1c10uZm9jdXMoKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBmb2N1cyhpdGVtLCBpdGVtLnN1Yk1lbnVbbmV4dEZvY3VzXSk7IC8vbWFrZSBpdCBhY2Nlc3NpYmxlIHZpYSBjc3MgdmlzdWFsIGNsdWVzIGV2ZW4gaWYgdGhlIGFjdGl2ZSBlbGVtZW50IGlzIGhpZGRlbiB3aXRoaW4gc2hhZG93RE9NXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgfSkpO1xuICAgIH07XG5cbiAgICBldmVudHMoKTtcbn1cblxuLy9oZWxwZXIgZnVuY3Rpb25zXG5cbi8vYWRkcyBtdWx0aXBsZSBldmVudCBsaXN0ZW5lcnMgd2l0aCBpZGVudGljYWwgaGFuZGxlcnNcbmZ1bmN0aW9uIGFkZEV2ZW50TGlzdGVuZXJzKGVsZW1lbnQsIGV2ZW50cywgaGFuZGxlcikge1xuICAgIGV2ZW50cy5zcGxpdCgnICcpLmZvckVhY2goZXZlbnQgPT4gZWxlbWVudC5hZGRFdmVudExpc3RlbmVyKGV2ZW50LCBoYW5kbGVyKSk7XG59XG5cbi8vIEFkZHMgYSAnZm9jdXNlZCcgYXR0cmlidXRlIHRvIHRoZSBkZXNpcmVkIHN1Yml0ZW0gYW5kXG4vLyByZW1vdmVzIGl0IGZyb20gb3RoZXIgc3ViIGl0ZW1zIHRvIGhlbHBcbi8vIHdpdGggYWNjZXNzaWJpbGl0eSBhbmQgc2hhZG93IERPbSBzdHlsaW5nLlxuZnVuY3Rpb24gZm9jdXMoaXRlbSwgZWxlbWVudCkge1xuICAgIGxldCBzdWJzID0gaXRlbS5zdWJNZW51O1xuICAgIHN1YnMuZm9yRWFjaCgoc3ViKSA9PiB7XG4gICAgICAgIGlmIChzdWIgPT09IGVsZW1lbnQpIHtcbiAgICAgICAgICAgIHN1Yi5zZXRBdHRyaWJ1dGUoJ2ZvY3VzZWQnLCAnJyk7XG4gICAgICAgICAgICBpdGVtLmZvY3VzZWQgPSBlbGVtZW50O1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgc3ViLnJlbW92ZUF0dHJpYnV0ZSgnZm9jdXNlZCcpO1xuICAgICAgICB9XG4gICAgfSk7XG59XG4iLCIvKlxuICogQSBtb2R1bGUgZm9yIGEgY3VzdG9tIEhUTUwgZWxlbWVudCBpbWFnZS1nYWxsZXJ5LWFwcCB0byBmb3JtIHBhcnQgb2YgYSB3ZWIgY29tcG9uZW50LlxuICogSXQgY29tYmluZWQgdGhlIGNvbXBvbmVudCBpbWFnZS1nYWxsZXJ5IHdpdGggdGhlIGNvbXBvbmVudCBkcmFnZ2FibGUtd2luZG93LCB0b1xuICogbWFrZSBhbiBpbWFnZSBnYWxsZXJ5IGluIGEgd2luZG93IHdpdGggYW4gYWRkZWQgbWVudS5cbiAqIEBhdXRob3IgTW9sbHkgQXJoYW1tYXJcbiAqIEB2ZXJzaW9uIDEuMC4wXG4gKlxuICovXG5cbmNsYXNzIEltYWdlR2FsbGVyeUFwcCBleHRlbmRzIEhUTUxFbGVtZW50IHtcbiAgICAvKipcbiAgICAgKiBJbml0aWF0ZXMgYSBnYWxsZXJ5LXdpbmRvdywgc2V0cyB1cCBzaGFkb3cgRE9NLlxuICAgICAqL1xuICAgIGNvbnN0cnVjdG9yKCkge1xuICAgICAgICBzdXBlcigpO1xuICAgICAgICBsZXQgZ2FsbGVyeVdpbmRvd1RlbXBsYXRlID0gZG9jdW1lbnQucXVlcnlTZWxlY3RvcignbGlua1tocmVmPVwiL2ltYWdlLWdhbGxlcnktYXBwLmh0bWxcIl0nKS5pbXBvcnQucXVlcnlTZWxlY3RvcignI2dhbGxlcnlXaW5kb3dUZW1wbGF0ZScpO1xuXG4gICAgICAgIGxldCBzaGFkb3dSb290ID0gdGhpcy5hdHRhY2hTaGFkb3coe21vZGU6IFwib3BlblwifSk7XG4gICAgICAgIGxldCBpbnN0YW5jZSA9IGdhbGxlcnlXaW5kb3dUZW1wbGF0ZS5jb250ZW50LmNsb25lTm9kZSh0cnVlKTtcbiAgICAgICAgc2hhZG93Um9vdC5hcHBlbmRDaGlsZChpbnN0YW5jZSk7XG5cbiAgICAgICAgdGhpcy5pbWFnZXMgPSBbXTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBSdW5zIHdoZW4gZ2FsbGVyeSBpcyBpbnNlcnRlZCBpbnRvIHRoZSBET00uXG4gICAgICogU2V0cyB1cCBldmVudCBsaXN0ZW5lcnMgZm9yXG4gICAgICogdGhlIG1lbnUuXG4gICAgICovXG4gICAgY29ubmVjdGVkQ2FsbGJhY2soKSB7XG4gICAgICAgIGxldCBpbWFnZUdhbGxlcnkgPSB0aGlzLnNoYWRvd1Jvb3QucXVlcnlTZWxlY3RvcignaW1hZ2UtZ2FsbGVyeScpO1xuICAgICAgICBsZXQgYWJvdXRzcGFjZSA9IHRoaXMuc2hhZG93Um9vdC5xdWVyeVNlbGVjdG9yKCcjYWJvdXQnKTtcblxuICAgICAgICBsZXQgZ2FsbGVyeU9wdGlvbiA9IHRoaXMuc2hhZG93Um9vdC5xdWVyeVNlbGVjdG9yKCdbbGFiZWw9XCJnYWxsZXJ5XCJdJyk7XG4gICAgICAgIGxldCBxdWl0T3B0aW9uID0gdGhpcy5zaGFkb3dSb290LnF1ZXJ5U2VsZWN0b3IoJ1tsYWJlbD1cInF1aXRcIl0nKTtcbiAgICAgICAgbGV0IGFib3V0T3B0aW9uID0gdGhpcy5zaGFkb3dSb290LnF1ZXJ5U2VsZWN0b3IoJ1tsYWJlbD1cImFib3V0XCJdJyk7XG5cbiAgICAgICAgdGhpcy51cGRhdGVJbWFnZXMoKTtcblxuICAgICAgICAvL21lbnUgZXZlbnQgbGlzdGVuZXJzLiBhZGQgc2VwYXJhdGUgb25lcyBmb3IgYWNjZXNzaWJpbGl0eSByZWFzb25zIHdpdGggd2ViIGNvbXBvbmVudHMuXG4gICAgICAgIHF1aXRPcHRpb24uYWRkRXZlbnRMaXN0ZW5lcignY2xpY2snLCAoZXZlbnQpID0+IHtcbiAgICAgICAgICAgIGxldCB0YXJnZXQgPSBldmVudC50YXJnZXQuZm9jdXNlZCB8fCBldmVudC50YXJnZXQucXVlcnlTZWxlY3RvcignW2RhdGEtdGFza10nKSB8fCBldmVudC50YXJnZXQ7IC8vc2hhZG93IERPTSBhY2Nlc3NpYmlsaXR5IGlzc3Vlc1xuICAgICAgICAgICAgbGV0IHRhc2sgPSB0YXJnZXQuZ2V0QXR0cmlidXRlKCdkYXRhLXRhc2snKTtcbiAgICAgICAgICAgIGlmICh0YXNrKSB7XG4gICAgICAgICAgICAgICAgc3dpdGNoICh0YXNrKSB7XG4gICAgICAgICAgICAgICAgICAgIGNhc2UgJ3F1aXQnOlxuICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5jbG9zZSgpO1xuICAgICAgICAgICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICB9LCB0cnVlKTtcblxuICAgICAgICAvL21lbnUgZXZlbnQgbGlzdGVuZXJcbiAgICAgICAgZ2FsbGVyeU9wdGlvbi5hZGRFdmVudExpc3RlbmVyKCdjbGljaycsIChldmVudCkgPT4ge1xuICAgICAgICAgICAgbGV0IHRhcmdldCA9IGV2ZW50LnRhcmdldC5xdWVyeVNlbGVjdG9yKCdbZGF0YS10YXNrXScpIHx8IGV2ZW50LnRhcmdldDsgLy9zaGFkb3cgRE9NIGFjY2Vzc2liaWxpdHkgaXNzdWVzXG4gICAgICAgICAgICBsZXQgdGFzayA9IHRhcmdldC5nZXRBdHRyaWJ1dGUoJ2RhdGEtdGFzaycpO1xuICAgICAgICAgICAgaWYgKHRhc2spIHtcbiAgICAgICAgICAgICAgICBzd2l0Y2ggKHRhc2spIHtcbiAgICAgICAgICAgICAgICAgICAgY2FzZSAnZ2FsbGVyeSc6XG4gICAgICAgICAgICAgICAgICAgICAgICBhYm91dHNwYWNlLmNsYXNzTGlzdC5hZGQoJ2hpZGUnKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGltYWdlR2FsbGVyeS5jbGFzc0xpc3QucmVtb3ZlKCdoaWRlJyk7XG4gICAgICAgICAgICAgICAgICAgICAgICBpbWFnZUdhbGxlcnkuc2hvd1RodW1ibmFpbHMoKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfSk7XG5cbiAgICAgICAgLy9tZW51IGV2ZW50IGxpc3RlbmVyXG4gICAgICAgIGFib3V0T3B0aW9uLmFkZEV2ZW50TGlzdGVuZXIoJ2NsaWNrJywgKGV2ZW50KSA9PiB7XG4gICAgICAgICAgICBsZXQgdGFyZ2V0ID0gZXZlbnQudGFyZ2V0LnF1ZXJ5U2VsZWN0b3IoJ1tkYXRhLXRhc2tdJykgfHwgZXZlbnQudGFyZ2V0OyAvL3NoYWRvdyBET00gYWNjZXNzaWJpbGl0eSBpc3N1ZXNcbiAgICAgICAgICAgIGxldCB0YXNrID0gdGFyZ2V0LmdldEF0dHJpYnV0ZSgnZGF0YS10YXNrJyk7XG4gICAgICAgICAgICBpZiAodGFzaykge1xuICAgICAgICAgICAgICAgIHN3aXRjaCAodGFzaykge1xuICAgICAgICAgICAgICAgICAgICBjYXNlICdhYm91dCc6XG4gICAgICAgICAgICAgICAgICAgICAgICBpbWFnZUdhbGxlcnkuY2xhc3NMaXN0LmFkZCgnaGlkZScpO1xuICAgICAgICAgICAgICAgICAgICAgICAgYWJvdXRzcGFjZS5jbGFzc0xpc3QucmVtb3ZlKCdoaWRlJyk7XG4gICAgICAgICAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH0pO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIEdldHMgYWxsIHRoZSBhZGRlZCBpbWFnZXNcbiAgICAgKiBAcmV0dXJucyB7Tm9kZUxpc3R9IGEgbGlzdCBvZiBhbGwgdGhlIGltYWdlIGVsZW1lbnRzIHRoYXQgYXJlXG4gICAgICogY2hpbGRyZW4gb2YgdGhlIGdhbGxlcnkuXG4gICAgICovXG4gICAgZ2V0SW1hZ2VzKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5xdWVyeVNlbGVjdG9yQWxsKCdpbWcnKTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBHZXRzIGFsbCB0aGUgaW1hZ2VkZXNjcmlwdGlvbnMuXG4gICAgICogQHJldHVybnMge05vZGVMaXN0fSBhIGxpc3Qgb2YgYWxsIHRoZSBwIGVsZW1lbnRzIHRoYXQgYXJlXG4gICAgICogY2hpbGRyZW4gb2YgdGhlIGdhbGxlcnkgYW5kIGhhcyBhIGZvci1hdHRyaWJ1dGUuXG4gICAgICovXG4gICAgZ2V0RGVzY3JpcHRpb25zKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5xdWVyeVNlbGVjdG9yQWxsKCdwW2Zvcl0nKTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBNYXRjaGVzIGRlc2NyaXB0aW9ucyB3aXRoIGltYWdlLXNvdXJjZXMgdmlhIHRoZSBtYXRjaGluZyBmb3ItIGFuZCBsYWJlbC0gYXR0cmlidXRlc1xuICAgICAqIG9uIHRoZSBwIGFuZCBpbWcgZWxlbWVudHMgcmVzcGVjdGl2ZWx5LlxuICAgICAqL1xuICAgIHVwZGF0ZUltYWdlcygpIHtcbiAgICAgICAgbGV0IGltZ1RlbXBsYXRlID0gZG9jdW1lbnQucXVlcnlTZWxlY3RvcignbGlua1tocmVmPVwiL2ltYWdlLWdhbGxlcnktYXBwLmh0bWxcIl0nKS5pbXBvcnQucXVlcnlTZWxlY3RvcihcIiNpbWdUZW1wbGF0ZVwiKTsgLy9zaGFkb3cgRE9NIGltcG9ydFxuICAgICAgICBsZXQgaW1hZ2VHYWxsZXJ5ID0gdGhpcy5zaGFkb3dSb290LnF1ZXJ5U2VsZWN0b3IoJ2ltYWdlLWdhbGxlcnknKTtcblxuICAgICAgICB0aGlzLmltYWdlcyA9IHRoaXMuaW1hZ2VzLmNvbmNhdChBcnJheS5wcm90b3R5cGUuc2xpY2UuY2FsbCh0aGlzLmdldEltYWdlcygpKSk7XG4gICAgICAgIHRoaXMuZGVzY3JpcHRpb25zID0gdGhpcy5nZXREZXNjcmlwdGlvbnMoKTtcblxuICAgICAgICB0aGlzLmltYWdlcy5mb3JFYWNoKChpbWFnZSkgPT4ge1xuICAgICAgICAgICAgbGV0IGNvbnRhaW5lciA9IGltZ1RlbXBsYXRlLmNvbnRlbnQuY2xvbmVOb2RlKHRydWUpO1xuICAgICAgICAgICAgY29udGFpbmVyLmZpcnN0RWxlbWVudENoaWxkLnJlcGxhY2VDaGlsZChpbWFnZSwgY29udGFpbmVyLmZpcnN0RWxlbWVudENoaWxkLnF1ZXJ5U2VsZWN0b3IoJ2ltZycpKTtcbiAgICAgICAgICAgIGNvbnRhaW5lci5yZW1vdmVDaGlsZChjb250YWluZXIucXVlcnlTZWxlY3RvcigncCcpKTtcbiAgICAgICAgICAgIGltYWdlR2FsbGVyeS5hcHBlbmRDaGlsZChjb250YWluZXIpO1xuICAgICAgICB9KTtcblxuICAgICAgICBBcnJheS5wcm90b3R5cGUuZm9yRWFjaC5jYWxsKHRoaXMuZGVzY3JpcHRpb25zLCAoZGVzY3JpcHRpb24pID0+IHtcbiAgICAgICAgICAgIGltYWdlR2FsbGVyeS5hcHBlbmRDaGlsZChkZXNjcmlwdGlvbik7XG4gICAgICAgIH0pO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIEByZXR1cm5zIHRydWUgaWYgdGhlIHdpbmRvdyBjb250YWluaW5nIHRoZSBhcHAgaXMgb3Blbi5cbiAgICAgKi9cbiAgICBnZXQgb3BlbigpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuc2hhZG93Um9vdC5xdWVyeVNlbGVjdG9yKCdkcmFnZ2FibGUtd2luZG93Jykub3BlbjtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBAcmV0dXJucyB0cnVlIGlmIHRoZSB3aW5kb3cgY29udGFpbmluZyB0aGUgYXBwIGlzIG1pbmltaXplZC5cbiAgICAgKi9cbiAgICBnZXQgbWluaW1pemVkKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5zaGFkb3dSb290LnF1ZXJ5U2VsZWN0b3IoJ2RyYWdnYWJsZS13aW5kb3cnKS5taW5pbWl6ZWQ7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogU2V0cyB0aGUgbWluaW1pemVkIHByb3BlcnR5IG9mIHRoZSB3aW5kb3cgY29udGFpbmluZyB0aGUgYXBwLlxuICAgICAqIEBwYXJhbSBtaW5pbWl6ZSB7Ym9vbGVhbn0gd2hldGhlciB0byBtaW5pbWl6ZVxuICAgICAqL1xuICAgIHNldCBtaW5pbWl6ZWQobWluaW1pemUpIHtcbiAgICAgICAgdGhpcy5zaGFkb3dSb290LnF1ZXJ5U2VsZWN0b3IoJ2RyYWdnYWJsZS13aW5kb3cnKS5taW5pbWl6ZWQgPSBtaW5pbWl6ZTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBDbG9zZXMgdGhlIHdpbmRvdyBjb250YWluaW5nIHRoZSBhcHAuXG4gICAgICovXG4gICAgY2xvc2UoKSB7XG4gICAgICAgIHRoaXMuc2hhZG93Um9vdC5xdWVyeVNlbGVjdG9yKCdkcmFnZ2FibGUtd2luZG93JykuY2xvc2UoKTtcbiAgICB9XG5cbn1cblxuXG4vL2RlZmluZSB0aGUgZWxlbWVudFxuY3VzdG9tRWxlbWVudHMuZGVmaW5lKCdpbWFnZS1nYWxsZXJ5LWFwcCcsIEltYWdlR2FsbGVyeUFwcCk7XG4iLCIvKlxuICogQSBtb2R1bGUgZm9yIGEgY3VzdG9tIEhUTUwgZWxlbWVudCBpbWFnZS1nYWxsZXJ5IHRvIGZvcm0gcGFydCBvZiBhIHdlYiBjb21wb25lbnQuXG4gKiBJdCBjcmVhdGVzIGEgZ2FsbGVyeSB0aGF0IGRpc3BsYXlzIGNsaWNrYWJsZSBpbWFnZXMgYXMgdGh1bWJuYWlscy5cbiAqIEBhdXRob3IgTW9sbHkgQXJoYW1tYXJcbiAqIEB2ZXJzaW9uIDEuMC4wXG4gKlxuICovXG5cbmNsYXNzIEltYWdlR2FsbGVyeSBleHRlbmRzIEhUTUxFbGVtZW50IHtcbiAgICAvKipcbiAgICAgKiBJbml0aWF0ZXMgYSBnYWxsZXJ5LCBzZXRzIHVwIHNoYWRvdyBET00uXG4gICAgICovXG4gICAgY29uc3RydWN0b3IoKSB7XG4gICAgICAgIHN1cGVyKCk7XG4gICAgICAgIGxldCBnYWxsZXJ5VGVtcGxhdGUgPSBkb2N1bWVudC5xdWVyeVNlbGVjdG9yKCdsaW5rW2hyZWY9XCIvaW1hZ2UtZ2FsbGVyeS1hcHAuaHRtbFwiXScpLmltcG9ydC5xdWVyeVNlbGVjdG9yKCdsaW5rW2hyZWY9XCIvaW1hZ2UtZ2FsbGVyeS5odG1sXCJdJykuaW1wb3J0LnF1ZXJ5U2VsZWN0b3IoXCIjZ2FsbGVyeVRlbXBsYXRlXCIpOyAvL3NoYWRvdyBET00gaW1wb3J0XG5cbiAgICAgICAgLy9zZXR1cCBzaGFkb3cgZG9tIHN0eWxlc1xuICAgICAgICBsZXQgc2hhZG93Um9vdCA9IHRoaXMuYXR0YWNoU2hhZG93KHttb2RlOiBcIm9wZW5cIn0pO1xuICAgICAgICBsZXQgaW5zdGFuY2UgPSBnYWxsZXJ5VGVtcGxhdGUuY29udGVudC5jbG9uZU5vZGUodHJ1ZSk7XG4gICAgICAgIHNoYWRvd1Jvb3QuYXBwZW5kQ2hpbGQoaW5zdGFuY2UpO1xuXG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogUnVucyB3aGVuIGdhbGxlcnkgaXMgaW5zZXJ0ZWQgaW50byB0aGUgRE9NLlxuICAgICAqIFNldHMgdXAgZXZlbnQgbGlzdGVuZXJzIGFuZCB0cmFja3MgdGhlIHBpY3R1cmUgc291cmNlcy5cbiAgICAgKi9cbiAgICBjb25uZWN0ZWRDYWxsYmFjaygpIHtcbiAgICAgICAgbGV0IGdhbGxlcnkgPSB0aGlzLnNoYWRvd1Jvb3QucXVlcnlTZWxlY3RvcignI2dhbGxlcnknKTtcbiAgICAgICAgbGV0IGltYWdlRGlzcGxheSA9IHRoaXMuc2hhZG93Um9vdC5xdWVyeVNlbGVjdG9yKCcjaW1hZ2VEaXNwbGF5Jyk7XG4gICAgICAgIGxldCBsb2NhbE5hdiA9IHRoaXMuc2hhZG93Um9vdC5xdWVyeVNlbGVjdG9yKCcjbG9jYWxOYXYnKTtcblxuICAgICAgICAvL21ha2UgYXJyYXkgb2YgYWxsIHRoZSBwaWN0dXJlIHNvdXJjZXMgZm9yIHRyYXZlcnNpbmdcbiAgICAgICAgdGhpcy5waWN0dXJlU291cmNlcyA9IFtdO1xuICAgICAgICBBcnJheS5wcm90b3R5cGUuZm9yRWFjaC5jYWxsKHRoaXMucXVlcnlTZWxlY3RvckFsbCgnW3Nsb3QgPVwicGljdHVyZVwiJyksIChhKSA9PiB7XG4gICAgICAgICAgICBpZiAoYS5oYXNBdHRyaWJ1dGUoJ3NyYycpICYmIHRoaXMucGljdHVyZVNvdXJjZXMuaW5kZXhPZihhLmdldEF0dHJpYnV0ZSgnc3JjJykpID09PSAtMSkge1xuICAgICAgICAgICAgICAgIHRoaXMucGljdHVyZVNvdXJjZXMucHVzaChhLmdldEF0dHJpYnV0ZSgnc3JjJykpO1xuICAgICAgICAgICAgfSBlbHNlIGlmIChhLmZpcnN0RWxlbWVudENoaWxkICYmIGEuZmlyc3RFbGVtZW50Q2hpbGQuaGFzQXR0cmlidXRlKCdzcmMnKSAmJiB0aGlzLnBpY3R1cmVTb3VyY2VzLmluZGV4T2YoYS5maXJzdEVsZW1lbnRDaGlsZC5nZXRBdHRyaWJ1dGUoJ3NyYycpKSA9PT0gLTEpIHtcbiAgICAgICAgICAgICAgICB0aGlzLnBpY3R1cmVTb3VyY2VzLnB1c2goYS5maXJzdEVsZW1lbnRDaGlsZC5nZXRBdHRyaWJ1dGUoJ3NyYycpKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSk7XG5cbiAgICAgICAgZ2FsbGVyeS5hZGRFdmVudExpc3RlbmVyKCdjbGljaycsIChldmVudCkgPT4ge1xuICAgICAgICAgICAgbGV0IHNyYyA9IGV2ZW50LnRhcmdldC5nZXRBdHRyaWJ1dGUoJ3NyYycpIHx8IGV2ZW50LnRhcmdldC5maXJzdEVsZW1lbnRDaGlsZC5nZXRBdHRyaWJ1dGUoJ3NyYycpO1xuXG4gICAgICAgICAgICBpZiAoc3JjKSB7XG4gICAgICAgICAgICAgICAgZ2FsbGVyeS5jbGFzc0xpc3QuYWRkKCdoaWRlJyk7XG4gICAgICAgICAgICAgICAgaW1hZ2VEaXNwbGF5LmNsYXNzTGlzdC5yZW1vdmUoJ2hpZGUnKTtcbiAgICAgICAgICAgICAgICB0aGlzLmRpc3BsYXlQaWN0dXJlKHNyYywgaW1hZ2VEaXNwbGF5KTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSk7XG5cbiAgICAgICAgbG9jYWxOYXYuYWRkRXZlbnRMaXN0ZW5lcignY2xpY2snLCAoZXZlbnQpID0+IHtcbiAgICAgICAgICAgICAgICBsZXQgdGFzayA9IGV2ZW50LnRhcmdldC5nZXRBdHRyaWJ1dGUoJ2RhdGEtdGFzaycpO1xuICAgICAgICAgICAgICAgIGxldCBjdXJyZW50UGljdHVyZSA9IGltYWdlRGlzcGxheS5xdWVyeVNlbGVjdG9yKCdpbWcuZGlzcGxheWVkJyk7XG4gICAgICAgICAgICAgICAgbGV0IGN1cnJlbnRQaWN0dXJlU3JjID0gY3VycmVudFBpY3R1cmUuZ2V0QXR0cmlidXRlKCdzcmMnKTtcbiAgICAgICAgICAgICAgICBsZXQgbmV4dFBpY3R1cmVTcmM7XG5cbiAgICAgICAgICAgICAgIGlmICh0aGlzLnF1ZXJ5U2VsZWN0b3JBbGwoJ1tzbG90ID1cInBpY3R1cmVcIicpLmxlbmd0aCAhPT0gdGhpcy5waWN0dXJlU291cmNlcy5sZW5ndGgpIHsgLy9jaGVjayBpZiBtb3JlIHBpY3R1cmVzIGhhcyBiZWVuIGFkZGVkXG4gICAgICAgICAgICAgICAgICAgIEFycmF5LnByb3RvdHlwZS5mb3JFYWNoLmNhbGwodGhpcy5xdWVyeVNlbGVjdG9yQWxsKCdbc2xvdCA9XCJwaWN0dXJlXCInKSwgKGEpID0+IHsgLy9pbiB0aGF0IGNhc2UgdXBkYXRlIHNvdXJjZWxpc3RcbiAgICAgICAgICAgICAgICAgICAgICAgIGxldCBzcmMgPSBhLmdldEF0dHJpYnV0ZSgnc3JjJykgfHwgYS5maXJzdEVsZW1lbnRDaGlsZC5nZXRBdHRyaWJ1dGUoJ3NyYycpO1xuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKHRoaXMucGljdHVyZVNvdXJjZXMuaW5kZXhPZihzcmMpID09PSAtMSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMucGljdHVyZVNvdXJjZXMucHVzaChzcmMpO1xuICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICAvL3RyYXZlcnNlIHRocm91Z2ggdGhlIHBpY3R1cmUgc291cmNlc1xuICAgICAgICAgICAgICAgIHN3aXRjaCAodGFzaykge1xuICAgICAgICAgICAgICAgICAgICBjYXNlICdmb3J3YXJkJzpcbiAgICAgICAgICAgICAgICAgICAgICAgIG5leHRQaWN0dXJlU3JjID0gdGhpcy5waWN0dXJlU291cmNlcy5pbmRleE9mKGN1cnJlbnRQaWN0dXJlU3JjKSArIDE7XG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAobmV4dFBpY3R1cmVTcmMgPT09IHRoaXMucGljdHVyZVNvdXJjZXMubGVuZ3RoKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgbmV4dFBpY3R1cmVTcmMgPSAwO1xuICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgICAgbmV4dFBpY3R1cmVTcmMgPSB0aGlzLnBpY3R1cmVTb3VyY2VzW25leHRQaWN0dXJlU3JjXTtcbiAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMuZGlzcGxheVBpY3R1cmUobmV4dFBpY3R1cmVTcmMsIGltYWdlRGlzcGxheSk7XG4gICAgICAgICAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgICAgICAgICAgY2FzZSAnYmFjayc6XG4gICAgICAgICAgICAgICAgICAgICAgICBuZXh0UGljdHVyZVNyYyA9IHRoaXMucGljdHVyZVNvdXJjZXMuaW5kZXhPZihjdXJyZW50UGljdHVyZVNyYykgLSAxO1xuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKG5leHRQaWN0dXJlU3JjIDwgMCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIG5leHRQaWN0dXJlU3JjID0gdGhpcy5waWN0dXJlU291cmNlcy5sZW5ndGggLSAxO1xuICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgICAgbmV4dFBpY3R1cmVTcmMgPSB0aGlzLnBpY3R1cmVTb3VyY2VzW25leHRQaWN0dXJlU3JjXTtcbiAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMuZGlzcGxheVBpY3R1cmUobmV4dFBpY3R1cmVTcmMsIGltYWdlRGlzcGxheSk7XG4gICAgICAgICAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgICAgICAgICAgY2FzZSAnZ2FsbGVyeSc6XG4gICAgICAgICAgICAgICAgICAgICAgIHRoaXMuc2hvd1RodW1ibmFpbHMoKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgfSk7XG5cbiAgICAgICAgLy9zaG93IGZ1bGwgaW1hZ2UgaW4gc2VwYXJhdGUgd2luZG93IGlmIGNsaWNrZWRcbiAgICAgICAgaW1hZ2VEaXNwbGF5LnF1ZXJ5U2VsZWN0b3IoJ2EuZGlzcGxheWVkJykuYWRkRXZlbnRMaXN0ZW5lcignY2xpY2snLCAoZXZlbnQpID0+IHtcbiAgICAgICAgICAgIGxldCBzcmMgPSBldmVudC50YXJnZXQuc3JjIHx8IGV2ZW50LnRhcmdldC5ocmVmO1xuICAgICAgICAgICAgaWYgKHNyYykge1xuICAgICAgICAgICAgICAgIG9wZW4oc3JjKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSk7XG5cbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBEaXNwbGF5cyBhbiBpbWFnZSB3aXRoIGEgZGVzY3JpcHRpb24uIERlc2NyaXB0aW9uIGhhcyB0byBoYXZlXG4gICAgICogYSBmb3ItYXR0cmlidXRlIHRoYXQgbWF0Y2hlcyB0aGUgaW1hZ2VzIGxhYmVsLWF0dHJpYnV0ZS5cbiAgICAgKiBAcGFyYW0gc3JjIHtzdHJpbmd9IHRoZSBzb3VyY2Ugb2YgdGhlIHBpY3R1cmUgdG8gZGlzcGxheVxuICAgICAqIEBwYXJhbSBkZXN0aW5hdGlvbiB7SFRNTEVsZW1lbnR9IHdoZXJlIHRvIGRpc3BsYXkgdGhlIGltYWdlLlxuICAgICAqL1xuICAgIGRpc3BsYXlQaWN0dXJlKHNyYywgZGVzdGluYXRpb24pIHtcbiAgICAgICAgbGV0IGRpc3BsYXkgPSBkZXN0aW5hdGlvbjtcbiAgICAgICAgbGV0IGltZyA9IGRpc3BsYXkucXVlcnlTZWxlY3RvcignaW1nLmRpc3BsYXllZCcpO1xuICAgICAgICBsZXQgYSA9IGRpc3BsYXkucXVlcnlTZWxlY3RvcignYS5kaXNwbGF5ZWQnKTtcbiAgICAgICAgbGV0IHAgPSBkaXNwbGF5LnF1ZXJ5U2VsZWN0b3IoJ3AjZGVzY3JpcHRpb24nKTtcblxuICAgICAgICBsZXQgY3VycmVudCA9IHRoaXMucXVlcnlTZWxlY3RvcignW3NyYz1cIicgKyBzcmMgKyAnXCJdJyk7XG4gICAgICAgIGxldCBsYWJlbCA9IGN1cnJlbnQuZ2V0QXR0cmlidXRlKCdsYWJlbCcpO1xuICAgICAgICBsZXQgZGVzY3JpcHRpb25Gb3IgPSBcIltmb3I9J1wiICsgbGFiZWwgKyBcIiddXCI7XG4gICAgICAgIGxldCBkZXNjcmlwdGlvbiA9IHRoaXMucXVlcnlTZWxlY3RvcihkZXNjcmlwdGlvbkZvcikudGV4dENvbnRlbnQ7XG5cbiAgICAgICAgaW1nLnNyYyA9IHNyYztcbiAgICAgICAgYS5ocmVmID0gc3JjO1xuICAgICAgICBwLnRleHRDb250ZW50ID0gZGVzY3JpcHRpb247XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogU2hvd3MgY2xpY2thYmxlIHRodW1ibmFpbHMgb2YgYWxsIHRoZSBpbWFnZXMgaW4gdGhlIGdhbGxlcnkuXG4gICAgICovXG4gICAgc2hvd1RodW1ibmFpbHMoKSB7XG4gICAgICAgIGxldCBnYWxsZXJ5ID0gdGhpcy5zaGFkb3dSb290LnF1ZXJ5U2VsZWN0b3IoJyNnYWxsZXJ5Jyk7XG4gICAgICAgIGxldCBpbWFnZURpc3BsYXkgPSB0aGlzLnNoYWRvd1Jvb3QucXVlcnlTZWxlY3RvcignI2ltYWdlRGlzcGxheScpO1xuXG4gICAgICAgIGdhbGxlcnkuY2xhc3NMaXN0LnJlbW92ZSgnaGlkZScpO1xuICAgICAgICBpbWFnZURpc3BsYXkuY2xhc3NMaXN0LmFkZCgnaGlkZScpO1xuXG4gICAgfVxufVxuXG5cbi8vZGVmaW5lcyB0aGUgZWxlbWVudFxuY3VzdG9tRWxlbWVudHMuZGVmaW5lKCdpbWFnZS1nYWxsZXJ5JywgSW1hZ2VHYWxsZXJ5KTtcbiIsIi8qXG4gKiBBIG1vZHVsZSBmb3IgYSBjdXN0b20gSFRNTCBlbGVtZW50IGluc3RhLWNoYXQtYXBwIHRvIGZvcm0gcGFydCBvZiBhIHdlYiBjb21wb25lbnQuXG4gKiBJdCBjb21iaW5lZCB0aGUgY29tcG9uZW50IGluc3RhLWNoYXQgd2l0aCB0aGUgY29tcG9uZW50IGRyYWdnYWJsZS13aW5kb3csIHRvXG4gKiBtYWtlIGEgY2hhdCBpbiBhIHdpbmRvdyB3aXRoIGFuIGFkZGVkIG1lbnUuXG4gKiBAYXV0aG9yIE1vbGx5IEFyaGFtbWFyXG4gKiBAdmVyc2lvbiAxLjAuMFxuICpcbiAqL1xuXG5sZXQgSW5zdGFDaGF0ID0gcmVxdWlyZSgnLi9pbnN0YS1jaGF0LmpzJyk7XG5cbmNsYXNzIEluc3RhQ2hhdEFwcCBleHRlbmRzIEhUTUxFbGVtZW50IHtcbiAgICAvKipcbiAgICAgKiBJbml0aWF0ZXMgYSBjaGF0LXdpbmRvdywgc2V0cyB1cCBzaGFkb3cgRE9NLlxuICAgICAqL1xuICAgIGNvbnN0cnVjdG9yKCkge1xuICAgICAgICBzdXBlcigpO1xuICAgICAgICBsZXQgY2hhdFdpbmRvd1RlbXBsYXRlID0gZG9jdW1lbnQucXVlcnlTZWxlY3RvcignbGlua1tocmVmPVwiL2luc3RhLWNoYXQtYXBwLmh0bWxcIl0nKS5pbXBvcnQucXVlcnlTZWxlY3RvcihcIiNjaGF0V2luZG93VGVtcGxhdGVcIik7IC8vc2hhZG93IERPTSBpbXBvcnRcblxuICAgICAgICBsZXQgc2hhZG93Um9vdCA9IHRoaXMuYXR0YWNoU2hhZG93KHttb2RlOiBcIm9wZW5cIn0pO1xuICAgICAgICBsZXQgaW5zdGFuY2UgPSBjaGF0V2luZG93VGVtcGxhdGUuY29udGVudC5jbG9uZU5vZGUodHJ1ZSk7XG4gICAgICAgIHNoYWRvd1Jvb3QuYXBwZW5kQ2hpbGQoaW5zdGFuY2UpO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFJ1bnMgd2hlbiBjaGF0IGlzIGluc2VydGVkIGludG8gdGhlIERPTS5cbiAgICAgKiBTZXRzIHVwIGV2ZW50IGxpc3RlbmVycyBmb3JcbiAgICAgKiB0aGUgbWVudSwgYW5kIHByaW50cyBtZXNzYWdlc1xuICAgICAqIHNhdmVkIGluIGxvY2FsIHN0b3JhZ2UgaWYgYW55LlxuICAgICAqL1xuICAgIGNvbm5lY3RlZENhbGxiYWNrKCkge1xuICAgICAgICAvL2luaXRpYXRlIHRoZSBjaGF0XG4gICAgICAgIGxldCBjaGF0c3BhY2U7XG5cbiAgICAgICAgbGV0IG5hbWVzcGFjZSA9IHRoaXMuc2hhZG93Um9vdC5xdWVyeVNlbGVjdG9yKCcjc3VibWl0TmFtZScpO1xuICAgICAgICBsZXQgYWJvdXRzcGFjZSA9IHRoaXMuc2hhZG93Um9vdC5xdWVyeVNlbGVjdG9yKCcjYWJvdXQnKTtcbiAgICAgICAgbGV0IHNvY2tldHNwYWNlID0gdGhpcy5zaGFkb3dSb290LnF1ZXJ5U2VsZWN0b3IoJyNjaG9vc2VTb2NrZXQnKTtcblxuICAgICAgICBsZXQgY2hhdG9wdGlvbiA9IHRoaXMuc2hhZG93Um9vdC5xdWVyeVNlbGVjdG9yKCdbbGFiZWw9XCJjaGF0XCJdJyk7XG4gICAgICAgIGxldCBhYm91dG9wdGlvbiA9IHRoaXMuc2hhZG93Um9vdC5xdWVyeVNlbGVjdG9yKCdbbGFiZWw9XCJhYm91dFwiXScpO1xuICAgICAgICBsZXQgb3B0aW9ub3B0aW9uID0gdGhpcy5zaGFkb3dSb290LnF1ZXJ5U2VsZWN0b3IoJ1tsYWJlbD1cIm9wdGlvbnNcIl0nKTtcblxuICAgICAgICAvL2NoZWNrIGlmIGEgc29ja2V0IGhhcyBhbHJlYWR5IGJlZW4gY2hvc2VuXG4gICAgICAgIGlmIChsb2NhbFN0b3JhZ2UuY2hhdENvbmZpZykge1xuICAgICAgICAgICAgbGV0IGNvbmZpZyA9IEpTT04ucGFyc2UobG9jYWxTdG9yYWdlLmNoYXRDb25maWcpO1xuICAgICAgICAgICAgY2hhdHNwYWNlID0gbmV3IEluc3RhQ2hhdChjb25maWcpO1xuXG4gICAgICAgICAgICBjaGF0c3BhY2Uuc2V0QXR0cmlidXRlKCdzbG90JywgJ2NvbnRlbnQnKTtcbiAgICAgICAgICAgIHRoaXMuc2hhZG93Um9vdC5xdWVyeVNlbGVjdG9yKCdkcmFnZ2FibGUtd2luZG93JykuYXBwZW5kQ2hpbGQoY2hhdHNwYWNlKTtcblxuICAgICAgICAgICAgLy9wcmludCB0aGUgbGFzdCB0d2VudHkgbWVzc2FnZXMgZnJvbSBsYXN0IHRpbWVcbiAgICAgICAgICAgIGxldCBtZXNzYWdlcyA9IGNoYXRzcGFjZS5tZXNzYWdlTWFuYWdlci5nZXRDaGF0TG9nKCkucmV2ZXJzZSgpO1xuICAgICAgICAgICAgaWYgKG1lc3NhZ2VzLmxlbmd0aCA+IDApIHtcbiAgICAgICAgICAgICAgICBtZXNzYWdlcy5mb3JFYWNoKChtZXNzYWdlKSA9PiB7XG4gICAgICAgICAgICAgICAgICAgIGNoYXRzcGFjZS5wcmludChtZXNzYWdlKTtcbiAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgLy9zY3JvbGwgZG93biB3aGVuIHdpbmRvdyBoYXMgYmVlbiByZW5kZXJlZFxuICAgICAgICAgICAgc2V0VGltZW91dCgoKSA9PiB7XG4gICAgICAgICAgICAgICAgY2hhdHNwYWNlLnNoYWRvd1Jvb3QucXVlcnlTZWxlY3RvcignI21lc3NhZ2VXaW5kb3cnKS5zY3JvbGxUb3AgPSBjaGF0c3BhY2Uuc2hhZG93Um9vdC5xdWVyeVNlbGVjdG9yKCcjbWVzc2FnZVdpbmRvdycpLnNjcm9sbEhlaWdodDtcbiAgICAgICAgICAgIH0sIDEwKTtcblxuICAgICAgICAgICAgYWJvdXRzcGFjZS5jbGFzc0xpc3QuYWRkKCdoaWRlJyk7XG4gICAgICAgICAgICBzb2NrZXRzcGFjZS5jbGFzc0xpc3QuYWRkKCdoaWRlJyk7XG4gICAgICAgICAgICBuYW1lc3BhY2UuY2xhc3NMaXN0LmFkZCgnaGlkZScpO1xuICAgICAgICAgICAgY2hhdHNwYWNlLmNsYXNzTGlzdC5yZW1vdmUoJ2hpZGUnKTtcbiAgICAgICAgfSBlbHNlIHsgLy9hc2sgZm9yIGEgc29ja2V0XG4gICAgICAgICAgICBhYm91dHNwYWNlLmNsYXNzTGlzdC5hZGQoJ2hpZGUnKTtcbiAgICAgICAgICAgIHNvY2tldHNwYWNlLmNsYXNzTGlzdC5yZW1vdmUoJ2hpZGUnKTtcbiAgICAgICAgICAgIG5hbWVzcGFjZS5jbGFzc0xpc3QuYWRkKCdoaWRlJyk7XG4gICAgICAgIH1cblxuICAgICAgICBzb2NrZXRzcGFjZS5xdWVyeVNlbGVjdG9yKCdidXR0b24nKS5hZGRFdmVudExpc3RlbmVyKCdjbGljaycsIChldmVudCkgPT4ge1xuICAgICAgICAgICAgbGV0IGFkZHJlc3MgPSBzb2NrZXRzcGFjZS5xdWVyeVNlbGVjdG9yKCdpbnB1dCNhZGRyZXNzJykudmFsdWU7XG4gICAgICAgICAgICBsZXQgY2hhbm5lbCA9IHNvY2tldHNwYWNlLnF1ZXJ5U2VsZWN0b3IoJ2lucHV0I2NoYW5uZWwnKS52YWx1ZTtcbiAgICAgICAgICAgIGxldCBhcGlrZXkgPSBzb2NrZXRzcGFjZS5xdWVyeVNlbGVjdG9yKCdpbnB1dCNhcGlrZXknKS52YWx1ZTtcbiAgICAgICAgICAgIGxldCBuYW1lID0gc29ja2V0c3BhY2UucXVlcnlTZWxlY3RvcignaW5wdXQjbmFtZScpLnZhbHVlO1xuXG4gICAgICAgICAgICBsZXQgY29uZmlnID0ge1xuICAgICAgICAgICAgICAgIHVybDogYWRkcmVzcyxcbiAgICAgICAgICAgICAgICBjaGFubmVsOiBjaGFubmVsLFxuICAgICAgICAgICAgICAgIGtleTogYXBpa2V5LFxuICAgICAgICAgICAgICAgIG5hbWU6IG5hbWVcbiAgICAgICAgICAgIH07XG5cbiAgICAgICAgICAgIGxvY2FsU3RvcmFnZS5jaGF0Q29uZmlnID0gSlNPTi5zdHJpbmdpZnkoY29uZmlnKTtcblxuICAgICAgICAgICAgY2hhdHNwYWNlID0gbmV3IEluc3RhQ2hhdChjb25maWcpO1xuXG4gICAgICAgICAgICBjaGF0c3BhY2Uuc2V0QXR0cmlidXRlKCdzbG90JywgJ2NvbnRlbnQnKTtcbiAgICAgICAgICAgIHRoaXMuc2hhZG93Um9vdC5xdWVyeVNlbGVjdG9yKCdkcmFnZ2FibGUtd2luZG93JykuYXBwZW5kQ2hpbGQoY2hhdHNwYWNlKTtcblxuICAgICAgICAgICAgY2hhdHNwYWNlLmNsYXNzTGlzdC5yZW1vdmUoJ2hpZGUnKTtcbiAgICAgICAgICAgIG5hbWVzcGFjZS5jbGFzc0xpc3QuYWRkKCdoaWRlJyk7XG4gICAgICAgICAgICBhYm91dHNwYWNlLmNsYXNzTGlzdC5hZGQoJ2hpZGUnKTtcbiAgICAgICAgICAgIHNvY2tldHNwYWNlLmNsYXNzTGlzdC5hZGQoJ2hpZGUnKTtcbiAgICAgICAgfSk7XG5cbiAgICAgICAgbmFtZXNwYWNlLnF1ZXJ5U2VsZWN0b3IoJ2J1dHRvbicpLmFkZEV2ZW50TGlzdGVuZXIoJ2NsaWNrJywgKGV2ZW50KSA9PiB7XG4gICAgICAgICAgICBsZXQgbmFtZSA9IG5hbWVzcGFjZS5xdWVyeVNlbGVjdG9yKCdpbnB1dCcpLnZhbHVlO1xuICAgICAgICAgICAgY2hhdHNwYWNlLmNoYW5nZUNvbmZpZyh7bmFtZTogbmFtZX0pO1xuICAgICAgICAgICAgbGV0IGNvbmZpZyA9IEpTT04ucGFyc2UobG9jYWxTdG9yYWdlLmNoYXRDb25maWcpO1xuICAgICAgICAgICAgY29uZmlnLm5hbWUgPSBuYW1lO1xuICAgICAgICAgICAgbG9jYWxTdG9yYWdlLmNoYXRDb25maWcgPSBKU09OLnN0cmluZ2lmeShjb25maWcpO1xuICAgICAgICAgICAgbmFtZXNwYWNlLmNsYXNzTGlzdC5hZGQoJ2hpZGUnKTtcbiAgICAgICAgICAgIGFib3V0c3BhY2UuY2xhc3NMaXN0LmFkZCgnaGlkZScpO1xuICAgICAgICAgICAgc29ja2V0c3BhY2UuY2xhc3NMaXN0LmFkZCgnaGlkZScpO1xuICAgICAgICAgICAgY2hhdHNwYWNlLmNsYXNzTGlzdC5yZW1vdmUoJ2hpZGUnKTtcbiAgICAgICAgfSk7XG5cbiAgICAgICAgLy9ldmVudCBsaXN0ZW5lcnMgZm9yIG1lbnUsIGFkZCBzZXBhcmF0ZSBvbmVzIGZvciBhY2Nlc3NpYmlsaXR5IHJlYXNvbnNcbiAgICAgICAgb3B0aW9ub3B0aW9uLmFkZEV2ZW50TGlzdGVuZXIoJ2NsaWNrJywgKGV2ZW50KSA9PiB7XG4gICAgICAgICAgICBsZXQgdGFyZ2V0ID0gZXZlbnQudGFyZ2V0LmZvY3VzZWQgfHwgZXZlbnQudGFyZ2V0LnF1ZXJ5U2VsZWN0b3IoJ1tkYXRhLXRhc2tdJykgfHwgZXZlbnQudGFyZ2V0O1xuICAgICAgICAgICAgbGV0IHRhc2sgPSB0YXJnZXQuZ2V0QXR0cmlidXRlKCdkYXRhLXRhc2snKTtcbiAgICAgICAgICAgIGlmICh0YXJnZXQuZ2V0QXR0cmlidXRlKCdkYXRhLXRhc2snKSkge1xuICAgICAgICAgICAgICAgIHN3aXRjaCAodGFyZ2V0LmdldEF0dHJpYnV0ZSgnZGF0YS10YXNrJykpIHtcbiAgICAgICAgICAgICAgICAgICAgY2FzZSAnbmFtZWNoYW5nZSc6XG4gICAgICAgICAgICAgICAgICAgICAgICBjaGF0c3BhY2UuY2xhc3NMaXN0LmFkZCgnaGlkZScpO1xuICAgICAgICAgICAgICAgICAgICAgICAgYWJvdXRzcGFjZS5jbGFzc0xpc3QuYWRkKCdoaWRlJyk7XG4gICAgICAgICAgICAgICAgICAgICAgICBzb2NrZXRzcGFjZS5jbGFzc0xpc3QuYWRkKCdoaWRlJyk7XG4gICAgICAgICAgICAgICAgICAgICAgICBuYW1lc3BhY2UuY2xhc3NMaXN0LnJlbW92ZSgnaGlkZScpO1xuICAgICAgICAgICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICAgICAgICAgIGNhc2UgJ3NvY2tldGNoYW5nZSc6XG4gICAgICAgICAgICAgICAgICAgICAgICBjaGF0c3BhY2UuY2xhc3NMaXN0LmFkZCgnaGlkZScpO1xuICAgICAgICAgICAgICAgICAgICAgICAgYWJvdXRzcGFjZS5jbGFzc0xpc3QuYWRkKCdoaWRlJyk7XG4gICAgICAgICAgICAgICAgICAgICAgICBuYW1lc3BhY2UuY2xhc3NMaXN0LmFkZCgnaGlkZScpO1xuICAgICAgICAgICAgICAgICAgICAgICAgc29ja2V0c3BhY2UuY2xhc3NMaXN0LnJlbW92ZSgnaGlkZScpO1xuICAgICAgICAgICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICAgICAgICAgIGNhc2UgJ3F1aXQnOlxuICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5jbG9zZSgpO1xuICAgICAgICAgICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICB9KTtcblxuICAgICAgICAvL2F2ZW50IGxpc3RlbmVyIGZvciBtZW51XG4gICAgICAgIGFib3V0b3B0aW9uLmFkZEV2ZW50TGlzdGVuZXIoJ2NsaWNrJywgKGV2ZW50KSA9PiB7XG4gICAgICAgICAgICBsZXQgdGFyZ2V0ID0gZXZlbnQudGFyZ2V0LmZvY3VzZWQgfHwgZXZlbnQudGFyZ2V0LnF1ZXJ5U2VsZWN0b3IoJ1tkYXRhLXRhc2tdJykgfHwgZXZlbnQudGFyZ2V0O1xuICAgICAgICAgICAgbGV0IHRhc2sgPSB0YXJnZXQuZ2V0QXR0cmlidXRlKCdkYXRhLXRhc2snKTtcbiAgICAgICAgICAgIGlmICh0YXJnZXQuZ2V0QXR0cmlidXRlKCdkYXRhLXRhc2snKSkge1xuICAgICAgICAgICAgICAgIHN3aXRjaCAodGFyZ2V0LmdldEF0dHJpYnV0ZSgnZGF0YS10YXNrJykpIHtcbiAgICAgICAgICAgICAgICAgICAgY2FzZSAnYWJvdXQnOlxuICAgICAgICAgICAgICAgICAgICAgICAgbmFtZXNwYWNlLmNsYXNzTGlzdC5hZGQoJ2hpZGUnKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGNoYXRzcGFjZS5jbGFzc0xpc3QuYWRkKCdoaWRlJyk7XG4gICAgICAgICAgICAgICAgICAgICAgICBzb2NrZXRzcGFjZS5jbGFzc0xpc3QuYWRkKCdoaWRlJyk7XG4gICAgICAgICAgICAgICAgICAgICAgICBhYm91dHNwYWNlLmNsYXNzTGlzdC5yZW1vdmUoJ2hpZGUnKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfSk7XG5cbiAgICAgICAgLy9ldmVudCBsaXN0ZW5lciBmb3IgbWVudVxuICAgICAgICBjaGF0b3B0aW9uLmFkZEV2ZW50TGlzdGVuZXIoJ2NsaWNrJywgKGV2ZW50KSA9PiB7XG4gICAgICAgICAgICBsZXQgdGFyZ2V0ID0gZXZlbnQudGFyZ2V0LmZvY3VzZWQgfHwgZXZlbnQudGFyZ2V0LnF1ZXJ5U2VsZWN0b3IoJ1tkYXRhLXRhc2tdJykgfHwgZXZlbnQudGFyZ2V0O1xuICAgICAgICAgICAgbGV0IHRhc2sgPSB0YXJnZXQuZ2V0QXR0cmlidXRlKCdkYXRhLXRhc2snKTtcbiAgICAgICAgICAgIGlmICh0YXJnZXQuZ2V0QXR0cmlidXRlKCdkYXRhLXRhc2snKSkge1xuICAgICAgICAgICAgICAgIHN3aXRjaCAodGFyZ2V0LmdldEF0dHJpYnV0ZSgnZGF0YS10YXNrJykpIHtcbiAgICAgICAgICAgICAgICAgICAgY2FzZSAnY2hhdCc6XG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAoY2hhdHNwYWNlKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgY2hhdHNwYWNlLmNsYXNzTGlzdC5yZW1vdmUoJ2hpZGUnKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBhYm91dHNwYWNlLmNsYXNzTGlzdC5hZGQoJ2hpZGUnKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBzb2NrZXRzcGFjZS5jbGFzc0xpc3QuYWRkKCdoaWRlJyk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgbmFtZXNwYWNlLmNsYXNzTGlzdC5hZGQoJ2hpZGUnKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH0pO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFJ1bnMgd2hlbiBhcHAgaXMgcmVtb3ZlZCBmcm9tIHRoZSBET00uXG4gICAgICogQ2xvc2VzIHRoZSB3aW5kb3cgYW5kIHRoZSB3ZWIgc29ja2V0LlxuICAgICAqL1xuICAgIGRpc2Nvbm5lY3RlZENhbGxiYWNrKCkge1xuICAgICAgICB0aGlzLmNsb3NlKCk7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogQHJldHVybnMgdHJ1ZSBpZiB0aGUgd2luZG93IGNvbnRhaW5pbmcgdGhlIGFwcCBpcyBvcGVuLlxuICAgICAqL1xuICAgIGdldCBvcGVuKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5zaGFkb3dSb290LnF1ZXJ5U2VsZWN0b3IoJ2RyYWdnYWJsZS13aW5kb3cnKS5vcGVuO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIEByZXR1cm5zIHRydWUgaWYgdGhlIHdpbmRvdyBjb250YWluaW5nIHRoZSBhcHAgaXMgbWluaW1pemVkLlxuICAgICAqL1xuICAgIGdldCBtaW5pbWl6ZWQoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLnNoYWRvd1Jvb3QucXVlcnlTZWxlY3RvcignZHJhZ2dhYmxlLXdpbmRvdycpLm1pbmltaXplZDtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBTZXRzIHRoZSBtaW5pbWl6ZWQgcHJvcGVydHkgb2YgdGhlIHdpbmRvdyBjb250YWluaW5nIHRoZSBhcHAuXG4gICAgICogQHBhcmFtIG1pbmltaXplIHtib29sZWFufSB3aGV0aGVyIHRvIG1pbmltaXplXG4gICAgICovXG4gICAgc2V0IG1pbmltaXplZChtaW5pbWl6ZSkge1xuICAgICAgICBpZiAobWluaW1pemUpIHtcbiAgICAgICAgICAgIHRoaXMuc2hhZG93Um9vdC5xdWVyeVNlbGVjdG9yKCdkcmFnZ2FibGUtd2luZG93JykubWluaW1pemVkID0gdHJ1ZTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHRoaXMuc2hhZG93Um9vdC5xdWVyeVNlbGVjdG9yKCdkcmFnZ2FibGUtd2luZG93JykubWluaW1pemVkID0gZmFsc2U7XG4gICAgICAgIH1cblxuICAgIH1cblxuICAgIC8qKlxuICAgICAqIENsb3NlcyB0aGUgd2luZG93IGFuZCB0aGUgd2ViIHNvY2tldC5cbiAgICAgKi9cbiAgICBjbG9zZSgpIHtcbiAgICAgICAgdGhpcy5zaGFkb3dSb290LnF1ZXJ5U2VsZWN0b3IoJ2RyYWdnYWJsZS13aW5kb3cnKS5jbG9zZSgpO1xuICAgICAgICB0aGlzLnNoYWRvd1Jvb3QucXVlcnlTZWxlY3RvcignaW5zdGEtY2hhdCcpLnNvY2tldC5jbG9zZSgpO1xuICAgIH1cbn1cblxuLy9kZWZpbmVzIHRoZSBlbGVtZW50XG5jdXN0b21FbGVtZW50cy5kZWZpbmUoJ2luc3RhLWNoYXQtYXBwJywgSW5zdGFDaGF0QXBwKTtcblxuXG5tb2R1bGUuZXhwb3J0cyA9IEluc3RhQ2hhdEFwcDtcbiIsIi8qXG4gKiBBIG1vZHVsZSBmb3IgYSBjdXN0b20gSFRNTCBlbGVtZW50IGluc3RhLWNoYXQgdG8gZm9ybSBwYXJ0IG9mIGEgd2ViIGNvbXBvbmVudC5cbiAqIEl0IGNyZWF0ZXMgYSBjaGF0IGNvbm5lY3RlZCB0byBhIHdlYiBzb2NrZXQgdGhhdCBzZW5kcywgcmVjZWl2ZXMgYW5kIHByaW50c1xuICogbWVzc2FnZXMuXG4gKiBAYXV0aG9yIE1vbGx5IEFyaGFtbWFyXG4gKiBAdmVyc2lvbiAxLjAuMFxuICpcbiAqL1xuXG5jbGFzcyBJbnN0YUNoYXQgZXh0ZW5kcyBIVE1MRWxlbWVudCB7XG4gICAgLyoqXG4gICAgICogSW5pdGlhdGVzIGEgY2hhdCwgc2V0cyB1cCBzaGFkb3cgRE9NLlxuICAgICAqIEBwYXJhbSBjb25maWcge29iamVjdH0gYSBjb25maWcgb2JqZWN0IHdpdGggdGhlIHdlYnNvY2tldHMgdXJsLCBjaGFubmVsLCBrZXkgYW5kIGEgbmFtZSBmb3IgdGhlIHVzZXJcbiAgICAgKiBAcGFyYW0gc3RhcnRNZXNzYWdlcyB7W09iamVjdF19IG1lc3NhZ2VzIHRvIHByaW50IGF0IHRoZSBzdGFydCBvZiB0aGUgY2hhdC5cbiAgICAgKi9cbiAgICBjb25zdHJ1Y3Rvcihjb25maWcgPSB7fSwgc3RhcnRNZXNzYWdlcykge1xuICAgICAgICBzdXBlcigpO1xuICAgICAgICBsZXQgY2hhdFRlbXBsYXRlID0gZG9jdW1lbnQucXVlcnlTZWxlY3RvcignbGlua1tocmVmPVwiL2luc3RhLWNoYXQtYXBwLmh0bWxcIl0nKS5pbXBvcnQucXVlcnlTZWxlY3RvcignbGlua1tocmVmPVwiL2luc3RhLWNoYXQuaHRtbFwiXScpLmltcG9ydC5xdWVyeVNlbGVjdG9yKFwiI2NoYXRUZW1wbGF0ZVwiKTsgLy9zaGFkb3cgRE9NIGltcG9ydFxuXG4gICAgICAgIC8vc2V0dXAgc2hhZG93IGRvbSBzdHlsZXNcbiAgICAgICAgbGV0IHNoYWRvd1Jvb3QgPSB0aGlzLmF0dGFjaFNoYWRvdyh7bW9kZTogXCJvcGVuXCJ9KTtcbiAgICAgICAgbGV0IGluc3RhbmNlID0gY2hhdFRlbXBsYXRlLmNvbnRlbnQuY2xvbmVOb2RlKHRydWUpO1xuICAgICAgICBzaGFkb3dSb290LmFwcGVuZENoaWxkKGluc3RhbmNlKTtcblxuICAgICAgICAvL3NldCBjb25maWcgb2JqZWN0IGFzIHRoaXMuY29uZmlnXG4gICAgICAgIHRoaXMuY29uZmlnID0ge1xuICAgICAgICAgICAgdXJsOiBjb25maWcudXJsIHx8ICcnLFxuICAgICAgICAgICAgbmFtZTogY29uZmlnLm5hbWUgfHwgJ3NldmVydXMgc25hcGUnLFxuICAgICAgICAgICAgY2hhbm5lbDogY29uZmlnLmNoYW5uZWwgfHwgJycsXG4gICAgICAgICAgICBrZXk6IGNvbmZpZy5rZXkgfHwgJydcbiAgICAgICAgfTtcbiAgICAgICAgdGhpcy5tZXNzYWdlcyA9IHN0YXJ0TWVzc2FnZXMgfHwgW107XG4gICAgICAgIHRoaXMuc29ja2V0ID0gbnVsbDtcbiAgICAgICAgdGhpcy5vbmxpbmVDaGVja2VyID0gbnVsbDtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBSdW5zIHdoZW4gY2hhdCBpcyBpbnNlcnRlZCBpbnRvIHRoZSBET00uXG4gICAgICogQ29ubmVjdHMgdG8gdGhlIHNlcnZlciwgc2V0cyB1cCBldmVudCBsaXN0ZW5lcnMgYW5kIHByaW50c1xuICAgICAqIGFscmVhZHkgc2F2ZWQgbWVzc2FnZXMgaWYgYW55LlxuICAgICAqL1xuICAgIGNvbm5lY3RlZENhbGxiYWNrKCkge1xuICAgICAgICAvL2Nvbm5lY3RcbiAgICAgICAgdGhpcy5jb25uZWN0KCk7XG5cbiAgICAgICAgLy9zZXQgZXZlbnQgbGlzdGVuZXIgdG8gc2VuZCBtZXNzYWdlIG9uIGVudGVyXG4gICAgICAgIHRoaXMuc2hhZG93Um9vdC5xdWVyeVNlbGVjdG9yKCcjbWVzc2FnZUFyZWEnKS5hZGRFdmVudExpc3RlbmVyKCdrZXlwcmVzcycsIChldmVudCkgPT4ge1xuICAgICAgICAgICAgaWYgKGV2ZW50LmtleSA9PT0gJ0VudGVyJykge1xuICAgICAgICAgICAgICAgIHRoaXMuc2VuZChldmVudC50YXJnZXQudmFsdWUpO1xuICAgICAgICAgICAgICAgIGV2ZW50LnRhcmdldC52YWx1ZSA9ICcnO1xuICAgICAgICAgICAgICAgIGV2ZW50LnByZXZlbnREZWZhdWx0KCk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH0pO1xuXG4gICAgICAgIC8vaWYgbWVzc2FnZXMgdG8gcHJpbnQgYXQgc3RhcnQgb2YgY2hhdCwgcHJpbnQgZWFjaFxuICAgICAgICBpZiAodGhpcy5tZXNzYWdlcy5sZW5ndGggPiAwKSB7XG4gICAgICAgICAgICB0aGlzLm1lc3NhZ2VzLmZvckVhY2goKG1lc3NhZ2UpID0+IHtcbiAgICAgICAgICAgICAgICB0aGlzLnByaW50KG1lc3NhZ2UpO1xuICAgICAgICAgICAgfSk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBDbG9zZXMgdGhlIHdlYiBzb2NrZXQgY29ubmVjdGlvbiBpZiBjaGF0IGlzIHJlbW92ZWQgZnJvbSB0aGUgRE9NLlxuICAgICAqL1xuICAgIGRpc2Nvbm5lY3RlZENhbGxiYWNrKCkge1xuICAgICAgICB0aGlzLnNvY2tldC5jbG9zZSgpO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIENvbm5lY3RzIHRvIHRoZSBXZWJTb2NrZXQgc2VydmVyLlxuICAgICAqIEByZXR1cm5zIHtQcm9taXNlfSB0aGF0IHJlc29sdmVzIHdoZW4gdGhlIGNvbm5lY3Rpb24gaXMgb3BlblxuICAgICAqIGFuZCByZWplY3RzIHdpdGggdGhlIHNlcnZlciByZXNwb25zZSBpZiBzb21ldGhpbmcgd2VudCB3cm9uZy5cbiAgICAgKiBJZiBhIGNvbm5lY3Rpb24gaXMgYWxyZWFkeSBvcGVuLCByZXNvbHZlcyB3aXRoXG4gICAgICogdGhlIHNvY2tldCBmb3IgdGhhdCBjb25uZWN0aW9uLlxuICAgICAqL1xuICAgIGNvbm5lY3QoKSB7XG4gICAgICAgIHJldHVybiBuZXcgUHJvbWlzZSgocmVzb2x2ZSwgcmVqZWN0KSA9PiB7XG5cbiAgICAgICAgICAgIGxldCBzb2NrZXQgPSB0aGlzLnNvY2tldDtcblxuICAgICAgICAgICAgLy9jaGVjayBmb3IgZXN0YWJsaXNoZWQgY29ubmVjdGlvblxuICAgICAgICAgICAgaWYgKHNvY2tldCAmJiBzb2NrZXQucmVhZHlTdGF0ZSAmJiBzb2NrZXQudXJsID09PSB0aGlzLmNvbmZpZy51cmwpIHtcbiAgICAgICAgICAgICAgICByZXNvbHZlKHNvY2tldCk7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIHNvY2tldCA9IG5ldyBXZWJTb2NrZXQodGhpcy5jb25maWcudXJsKTtcblxuICAgICAgICAgICAgICAgIHNvY2tldC5hZGRFdmVudExpc3RlbmVyKCdvcGVuJywgKCkgPT4ge1xuICAgICAgICAgICAgICAgICAgICByZXNvbHZlKHNvY2tldCk7XG4gICAgICAgICAgICAgICAgfSk7XG5cbiAgICAgICAgICAgICAgICBzb2NrZXQuYWRkRXZlbnRMaXN0ZW5lcignZXJyb3InLCAoZXZlbnQpID0+IHtcbiAgICAgICAgICAgICAgICAgICAgcmVqZWN0KG5ldyBFcnJvcignY291bGQgbm90IGNvbm5lY3QgdG8gc2VydmVyJykpO1xuICAgICAgICAgICAgICAgIH0pO1xuXG4gICAgICAgICAgICAgICAgc29ja2V0LmFkZEV2ZW50TGlzdGVuZXIoJ21lc3NhZ2UnLCAoZXZlbnQpID0+IHtcbiAgICAgICAgICAgICAgICAgICAgbGV0IHJlc3BvbnNlID0gSlNPTi5wYXJzZShldmVudC5kYXRhKTtcbiAgICAgICAgICAgICAgICAgICAgaWYgKHJlc3BvbnNlLnR5cGUgPT09ICdtZXNzYWdlJykge1xuICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5wcmludChyZXNwb25zZSk7XG4gICAgICAgICAgICAgICAgICAgICAgICB0aGlzLm1lc3NhZ2VNYW5hZ2VyLnNldENoYXRMb2cocmVzcG9uc2UpOyAvL3NhdmUgbWVzc2FnZSBpbiBsb2NhbCBzdG9yYWdlXG4gICAgICAgICAgICAgICAgICAgIH0gZWxzZSBpZiAocmVzcG9uc2UudHlwZSA9PT0gJ2hlYXJ0YmVhdCcpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMubWVzc2FnZU1hbmFnZXIuZ2V0VW5zZW50KCkuZm9yRWFjaCgobWVzc2FnZSkgPT4ge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMuc2VuZChtZXNzYWdlKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5tZXNzYWdlTWFuYWdlci5jbGVhclVuc2VudCgpOyAvL3B1c2ggdW5zZW50IG1lc3NhZ2VzIHdoZW4gdGhlcmUgaXMgYSBjb25uZWN0aW9uXG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9KTtcblxuICAgICAgICAgICAgICAgIHRoaXMuc29ja2V0ID0gc29ja2V0O1xuICAgICAgICAgICAgfVxuXG4gICAgICAgIH0pO1xuXG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogU2VuZHMgYSBtZXNzYWdlIHRvIHRoZSBzZXJ2ZXIuXG4gICAgICogQHBhcmFtIG1lc3NhZ2Uge3N0cmluZ30gdGhlIG1lc3NhZ2UgdG8gc2VuZC5cbiAgICAgKi9cbiAgICBzZW5kKG1lc3NhZ2UpIHtcblxuICAgICAgICBsZXQgZGF0YSA9IHtcbiAgICAgICAgICAgIHR5cGU6ICdtZXNzYWdlJyxcbiAgICAgICAgICAgIGRhdGE6IG1lc3NhZ2UsXG4gICAgICAgICAgICB1c2VybmFtZTogdGhpcy5jb25maWcubmFtZSxcbiAgICAgICAgICAgIGNoYW5uZWw6IHRoaXMuY29uZmlnLmNoYW5uZWwsXG4gICAgICAgICAgICBrZXk6IHRoaXMuY29uZmlnLmtleVxuICAgICAgICB9O1xuXG4gICAgICAgIHRoaXMuY29ubmVjdCgpXG4gICAgICAgICAgICAudGhlbigoc29ja2V0KSA9PiB7XG4gICAgICAgICAgICAgICAgc29ja2V0LnNlbmQoSlNPTi5zdHJpbmdpZnkoZGF0YSkpO1xuICAgICAgICB9KS5jYXRjaCgocmVzcG9uc2UpID0+IHtcbiAgICAgICAgICAgIHRoaXMubWVzc2FnZU1hbmFnZXIuc2V0VW5zZW50KGRhdGEpO1xuICAgICAgICAgICAgdGhpcy5wcmludChkYXRhLCB0cnVlKTsgLy9wcmludCBtZXNzYWdlIGFzIFwidW5zZW50XCIgdG8gbWFrZSBpdCBsb29rIGRpZmZlcmVudDtcbiAgICAgICAgfSk7XG5cbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBQcmludHMgYSBtZXNzYWdlLlxuICAgICAqIEBwYXJhbSBtZXNzYWdlIHtPYmplY3R9IHRoZSBtZXNzYWdlIHRvIHByaW50LlxuICAgICAqIEBwYXJhbSB1bnNlbnQge2Jvb2xlYW59IHRydWUgaWYgdGhlIG1lc3NhZ2UgaGFzIG5vdCBiZWVuIHN1Y2Nlc3NmdWxseSBzZW50XG4gICAgICovXG4gICAgcHJpbnQobWVzc2FnZSwgdW5zZW50KSB7XG4gICAgICAgIGxldCBtZXNzYWdlVGVtcGxhdGUgPSBkb2N1bWVudC5xdWVyeVNlbGVjdG9yKCdsaW5rW2hyZWY9XCIvaW5zdGEtY2hhdC1hcHAuaHRtbFwiXScpLmltcG9ydC5xdWVyeVNlbGVjdG9yKCdsaW5rW2hyZWY9XCIvaW5zdGEtY2hhdC5odG1sXCJdJykuaW1wb3J0LnF1ZXJ5U2VsZWN0b3IoXCIjbWVzc2FnZVRlbXBsYXRlXCIpOyAvL21lc3NhZ2UgZGlzcGxheSB0ZW1wbGF0ZVxuXG4gICAgICAgIGxldCBjaGF0V2luZG93ID0gdGhpcy5zaGFkb3dSb290LnF1ZXJ5U2VsZWN0b3IoJyNtZXNzYWdlV2luZG93Jyk7XG4gICAgICAgIGxldCBtZXNzYWdlRGl2ID0gZG9jdW1lbnQuaW1wb3J0Tm9kZShtZXNzYWdlVGVtcGxhdGUuY29udGVudC5maXJzdEVsZW1lbnRDaGlsZCwgdHJ1ZSk7XG4gICAgICAgIG1lc3NhZ2VEaXYucXVlcnlTZWxlY3RvcignLmF1dGhvcicpLnRleHRDb250ZW50ID0gbWVzc2FnZS5kYXRhLnVzZXJuYW1lIHx8IG1lc3NhZ2UudXNlcm5hbWU7XG4gICAgICAgIG1lc3NhZ2VEaXYucXVlcnlTZWxlY3RvcignLm1lc3NhZ2UnKS50ZXh0Q29udGVudCA9IG1lc3NhZ2UuZGF0YS5kYXRhIHx8IG1lc3NhZ2UuZGF0YTtcblxuICAgICAgICBpZiAodW5zZW50KSB7XG4gICAgICAgICAgICBtZXNzYWdlRGl2LmNsYXNzTGlzdC5hZGQoJ3Vuc2VudCcpO1xuICAgICAgICB9XG5cbiAgICAgICAgY2hhdFdpbmRvdy5hcHBlbmRDaGlsZChtZXNzYWdlRGl2KTtcbiAgICAgICAgY2hhdFdpbmRvdy5zY3JvbGxUb3AgPSBjaGF0V2luZG93LnNjcm9sbEhlaWdodDtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBSZXR1cm5zIGFuIG9iamVjdCB0byBtYW5hZ2UgbWVzc2FnZXMuXG4gICAgICogQHJldHVybnMge29iamVjdH0gdGhlIG9iamVjdC5cbiAgICAgKi9cbiAgICBnZXQgbWVzc2FnZU1hbmFnZXIoKSB7XG4gICAgICAgICAgICBsZXQgc3RvcmFnZSA9IGxvY2FsU3RvcmFnZTtcbiAgICAgICAgICAgIGxldCBjaGF0TG9nID0gW107XG4gICAgICAgICAgICBsZXQgdW5zZW50ID0gW107XG5cbiAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICAgIC8qKlxuICAgICAgICAgICAgICogUmV0cmlldmVzIGNoYXQgbG9nIGZyb20gbG9jYWwgc3RvcmFnZVxuICAgICAgICAgICAgICogQHJldHVybnMge09iamVjdH0gdGhlICwgb3IgdW5kZWZpbmVkIGlmIHRoZXJlIGFyZSBubyBtZXNzYWdlc1xuICAgICAgICAgICAgICovXG4gICAgICAgICAgICBnZXRDaGF0TG9nOiBmdW5jdGlvbigpIHtcbiAgICAgICAgICAgICAgICBpZiAoc3RvcmFnZS5jaGF0TG9nKSB7XG4gICAgICAgICAgICAgICAgICAgIGNoYXRMb2cgPSBKU09OLnBhcnNlKHN0b3JhZ2UuY2hhdExvZyk7XG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgcmV0dXJuIGNoYXRMb2c7XG4gICAgICAgICAgICB9LFxuICAgICAgICAgICAgLyoqXG4gICAgICAgICAgICAgKiBSZXRyaWV2ZXMgdW5zZW50IG1lc3NhZ2VzIGZyb20gbG9jYWwgc3RvcmFnZVxuICAgICAgICAgICAgICogQHJldHVybnMge09iamVjdH0gdGhlIG1lc3NhZ2VzLCBvciB1bmRlZmluZWQgaWYgdGhlcmUgYXJlIG5vIG1lc3NhZ2VzXG4gICAgICAgICAgICAgKi9cbiAgICAgICAgICAgIGdldFVuc2VudDogZnVuY3Rpb24oKSB7XG4gICAgICAgICAgICAgICAgaWYgKHN0b3JhZ2UudW5zZW50KSB7XG4gICAgICAgICAgICAgICAgICAgIHVuc2VudCA9IEpTT04ucGFyc2Uoc3RvcmFnZS51bnNlbnQpO1xuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIHJldHVybiB1bnNlbnQ7XG4gICAgICAgICAgICB9LFxuICAgICAgICAgICAgLyoqXG4gICAgICAgICAgICAgKiBzZXRzIHVuc2VudCBtZXNzYWdlcyBpbiBsb2NhbCBzdG9yYWdlXG4gICAgICAgICAgICAgKiBAcGFyYW0gbWVzc2FnZSB7b2JqZWN0fSB0aGUgbWVzc2FnZSBvYmplY3QgdG8gc2F2ZVxuICAgICAgICAgICAgICovXG4gICAgICAgICAgICBzZXRVbnNlbnQ6IGZ1bmN0aW9uKG1lc3NhZ2UpIHtcbiAgICAgICAgICAgICAgICBsZXQgb2xkTWVzc2FnZXM7XG5cbiAgICAgICAgICAgICAgICBpZiAoc3RvcmFnZS51bnNlbnQpIHtcbiAgICAgICAgICAgICAgICAgICAgb2xkTWVzc2FnZXMgPSBKU09OLnBhcnNlKHN0b3JhZ2UudW5zZW50KTtcbiAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICBvbGRNZXNzYWdlcyA9IFtdO1xuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIG9sZE1lc3NhZ2VzLnVuc2hpZnQobWVzc2FnZSk7XG5cbiAgICAgICAgICAgICAgICBzdG9yYWdlLnVuc2VudCA9IEpTT04uc3RyaW5naWZ5KG9sZE1lc3NhZ2VzKTtcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAvKipcbiAgICAgICAgICAgICAqIENsZWFycyB1bnNlbnQgbWVzc2FnZXMuXG4gICAgICAgICAgICAgKi9cbiAgICAgICAgICAgIGNsZWFyVW5zZW50OiBmdW5jdGlvbigpIHtcbiAgICAgICAgICAgICAgICBzdG9yYWdlLnJlbW92ZUl0ZW0oJ3Vuc2VudCcpO1xuICAgICAgICAgICAgfSxcblxuICAgICAgICAgICAgLyoqXG4gICAgICAgICAgICAgKiBTZXRzIHNlbnQgbWVzc2FnZXMgaW4gbG9jYWwgc3RvcmFnZVxuICAgICAgICAgICAgICogQHBhcmFtIG1lc3NhZ2Uge29iamVjdH0gdGhlIG1lc3NhZ2Ugb2JqZWN0IHRvIHNhdmVcbiAgICAgICAgICAgICAqL1xuICAgICAgICAgICAgc2V0Q2hhdExvZzogZnVuY3Rpb24obWVzc2FnZSkge1xuICAgICAgICAgICAgICAgIGxldCBvbGRNZXNzYWdlcztcblxuICAgICAgICAgICAgICAgIGlmIChzdG9yYWdlLmNoYXRMb2cpIHtcbiAgICAgICAgICAgICAgICAgICAgb2xkTWVzc2FnZXMgPSBKU09OLnBhcnNlKHN0b3JhZ2UuY2hhdExvZyk7XG4gICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgb2xkTWVzc2FnZXMgPSBbXTtcbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICBvbGRNZXNzYWdlcy51bnNoaWZ0KG1lc3NhZ2UpO1xuXG4gICAgICAgICAgICAgICAgaWYgKG9sZE1lc3NhZ2VzLmxlbmd0aCA+IDIwKSB7IC8va2VlcCB0aGUgbGlzdCB0byAyMCBtZXNzYWdlc1xuICAgICAgICAgICAgICAgICAgICBvbGRNZXNzYWdlcy5sZW5ndGggPSAyMDtcbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICBzdG9yYWdlLmNoYXRMb2cgPSBKU09OLnN0cmluZ2lmeShvbGRNZXNzYWdlcyk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH07XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogVXBkYXRlcyB0aGUgY29uZmlnIGZpbGUuXG4gICAgICogQHBhcmFtIGNvbmZpZyB7b2JqZWN0fSB0aGUgbmV3IHZhbHVlcyBpbiBhbiBvYmplY3QuXG4gICAgICovXG4gICAgY2hhbmdlQ29uZmlnKGNvbmZpZykge1xuICAgICAgICB0aGlzLmNvbmZpZy5uYW1lID0gY29uZmlnLm5hbWUgfHwgdGhpcy5jb25maWcubmFtZTtcbiAgICAgICAgdGhpcy5jb25maWcudXJsID0gY29uZmlnLnVybHx8IHRoaXMuY29uZmlnLnVybDtcbiAgICAgICAgdGhpcy5jb25maWcuY2hhbm5lbCA9IGNvbmZpZy5jaGFubmVsIHx8IHRoaXMuY29uZmlnLmNoYW5uZWw7XG4gICAgICAgIHRoaXMuY29uZmlnLmtleSA9IGNvbmZpZy5rZXkgfHwgdGhpcy5jb25maWcua2V5O1xuICAgIH1cbn1cblxuLy9kZWZpbmVzIHRoZSBlbGVtZW50XG5jdXN0b21FbGVtZW50cy5kZWZpbmUoJ2luc3RhLWNoYXQnLCBJbnN0YUNoYXQpO1xuXG5tb2R1bGUuZXhwb3J0cyA9IEluc3RhQ2hhdDtcbiIsIi8qXG4gKiBBIG1vZHVsZSBmb3IgYSBjdXN0b20gSFRNTCBlbGVtZW50IG1lbW9yeS1hcHAgdG8gZm9ybSBwYXJ0IG9mIGEgd2ViIGNvbXBvbmVudC5cbiAqIEl0IGNvbWJpbmVzIHRoZSBjb21wb25lbnQgbWVtb3J5LWdhbWUgd2l0aCB0aGUgY29tcG9uZW50IGRyYWdnYWJsZS13aW5kb3csIHRvXG4gKiBtYWtlIGEgY2hhdCBpbiBhIHdpbmRvdyB3aXRoIGFuIGFkZGVkIG1lbnUuXG4gKiBAYXV0aG9yIE1vbGx5IEFyaGFtbWFyXG4gKiBAdmVyc2lvbiAxLjAuMFxuICpcbiAqL1xuXG5jbGFzcyBNZW1vcnlBcHAgZXh0ZW5kcyBIVE1MRWxlbWVudCB7XG4gICAgLyoqXG4gICAgICogSW5pdGlhdGVzIGEgbWVtb3J5LXdpbmRvdywgc2V0cyB1cCBzaGFkb3cgRE9NLlxuICAgICAqL1xuICAgIGNvbnN0cnVjdG9yKCkge1xuICAgICAgICBzdXBlcigpO1xuICAgICAgICBsZXQgbWVtb3J5V2luZG93VGVtcGxhdGUgPSBkb2N1bWVudC5xdWVyeVNlbGVjdG9yKCdsaW5rW2hyZWY9XCIvbWVtb3J5LWFwcC5odG1sXCJdJykuaW1wb3J0LnF1ZXJ5U2VsZWN0b3IoXCIjbWVtb3J5V2luZG93VGVtcGxhdGVcIik7XG5cbiAgICAgICAgbGV0IHNoYWRvd1Jvb3QgPSB0aGlzLmF0dGFjaFNoYWRvdyh7bW9kZTogXCJvcGVuXCJ9KTtcbiAgICAgICAgbGV0IGluc3RhbmNlID0gbWVtb3J5V2luZG93VGVtcGxhdGUuY29udGVudC5jbG9uZU5vZGUodHJ1ZSk7XG4gICAgICAgIHNoYWRvd1Jvb3QuYXBwZW5kQ2hpbGQoaW5zdGFuY2UpO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFJ1bnMgd2hlbiBtZW1vcnktYXBwIGlzIGluc2VydGVkIGludG8gdGhlIERPTS5cbiAgICAgKiBTZXRzIHVwIGV2ZW50IGxpc3RlbmVycyBmb3JcbiAgICAgKiB0aGUgbWVudSBhbmQgZ2FtZSBib2FyZCBzaXplLlxuICAgICAqL1xuICAgIGNvbm5lY3RlZENhbGxiYWNrKCkge1xuICAgICAgICBsZXQgZ2FtZXNwYWNlID0gdGhpcy5zaGFkb3dSb290LnF1ZXJ5U2VsZWN0b3IoJ21lbW9yeS1nYW1lJyk7XG4gICAgICAgIGxldCBoaWdoc2NvcmVzcGFjZSA9IHRoaXMuc2hhZG93Um9vdC5xdWVyeVNlbGVjdG9yKCcjaGlnaHNjb3JlcycpO1xuICAgICAgICBsZXQgYWJvdXRzcGFjZSA9IHRoaXMuc2hhZG93Um9vdC5xdWVyeVNlbGVjdG9yKCcjYWJvdXQnKTtcblxuICAgICAgICBsZXQgZ2FtZSA9IHRoaXMuc2hhZG93Um9vdC5xdWVyeVNlbGVjdG9yKCdtZW1vcnktZ2FtZScpO1xuICAgICAgICBsZXQgZ2FtZU9wdGlvbnMgPSB0aGlzLnNoYWRvd1Jvb3QucXVlcnlTZWxlY3RvcignW2xhYmVsPVwiZ2FtZVwiXScpO1xuICAgICAgICBsZXQgaGlnaHNjb3Jlc09wdGlvbiA9IHRoaXMuc2hhZG93Um9vdC5xdWVyeVNlbGVjdG9yKCdbbGFiZWw9XCJoaWdoc2NvcmVcIl0nKTtcbiAgICAgICAgbGV0IGFib3V0T3B0aW9uID0gdGhpcy5zaGFkb3dSb290LnF1ZXJ5U2VsZWN0b3IoJ1tsYWJlbD1cImFib3V0XCJdJyk7XG5cbiAgICAgICAgLy9tZW51IGV2ZW50IGxpc3RlbmVycywgYWRkIHNlcGFyYXRlIG9uZXMgZm9yIGFjY2Vzc2liaWxpdHkgcmVhc29uc1xuICAgICAgICBnYW1lT3B0aW9ucy5hZGRFdmVudExpc3RlbmVyKCdjbGljaycsIChldmVudCkgPT4ge1xuICAgICAgICAgICAgbGV0IHRhcmdldCA9IGV2ZW50LnRhcmdldC5mb2N1c2VkIHx8IGV2ZW50LnRhcmdldC5xdWVyeVNlbGVjdG9yKCdbZGF0YS10YXNrXScpIHx8IGV2ZW50LnRhcmdldDsgLy9zaGFkb3cgRE9NIGFjY2Vzc2liaWxpdHkgaXNzdWVzXG4gICAgICAgICAgICBsZXQgdGFzayA9IHRhcmdldC5nZXRBdHRyaWJ1dGUoJ2RhdGEtdGFzaycpO1xuICAgICAgICAgICAgICAgIGlmICh0YXNrKSB7XG4gICAgICAgICAgICAgICAgICAgIHN3aXRjaCAodGFzaykge1xuICAgICAgICAgICAgICAgICAgICAgICAgY2FzZSAncmVzdGFydCc6XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgZ2FtZXNwYWNlLmNsYXNzTGlzdC5yZW1vdmUoJ2hpZGUnKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBoaWdoc2NvcmVzcGFjZS5jbGFzc0xpc3QuYWRkKCdoaWRlJyk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgYWJvdXRzcGFjZS5jbGFzc0xpc3QuYWRkKCdoaWRlJyk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgZ2FtZXNwYWNlLnJlcGxheSgpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgICAgICAgICAgICAgY2FzZSAnbmV3JzpcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBnYW1lc3BhY2UuY2xhc3NMaXN0LnJlbW92ZSgnaGlkZScpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGhpZ2hzY29yZXNwYWNlLmNsYXNzTGlzdC5hZGQoJ2hpZGUnKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBhYm91dHNwYWNlLmNsYXNzTGlzdC5hZGQoJ2hpZGUnKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBnYW1lc3BhY2UucmVzdGFydCgpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgICAgICAgICAgICAgY2FzZSAncXVpdCc6XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5jbG9zZSgpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICB9LCB0cnVlKTtcblxuICAgICAgICAvL21lbnUgZXZlbnQgbGlzdGVuZXJcbiAgICAgICAgaGlnaHNjb3Jlc09wdGlvbi5hZGRFdmVudExpc3RlbmVyKCdjbGljaycsIChldmVudCkgPT4ge1xuICAgICAgICAgICAgbGV0IHRhcmdldCA9IGV2ZW50LnRhcmdldC5xdWVyeVNlbGVjdG9yKCdbZGF0YS10YXNrXScpIHx8IGV2ZW50LnRhcmdldDsgLy9zaGFkb3cgRE9NIGFjY2Vzc2liaWxpdHkgaXNzdWVzXG4gICAgICAgICAgICBsZXQgdGFzayA9IHRhcmdldC5nZXRBdHRyaWJ1dGUoJ2RhdGEtdGFzaycpO1xuICAgICAgICAgICAgaWYgKHRhc2spIHtcbiAgICAgICAgICAgICAgICBzd2l0Y2ggKHRhc2spIHtcbiAgICAgICAgICAgICAgICAgICAgY2FzZSAnaGlnaHNjb3Jlcyc6XG4gICAgICAgICAgICAgICAgICAgICAgICBnYW1lLmVuZCgpO1xuICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy51cGRhdGVIaWdoc2NvcmVzKGdhbWUucmVzdWx0KTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGdhbWVzcGFjZS5jbGFzc0xpc3QuYWRkKCdoaWRlJyk7XG4gICAgICAgICAgICAgICAgICAgICAgICBoaWdoc2NvcmVzcGFjZS5jbGFzc0xpc3QucmVtb3ZlKCdoaWRlJyk7XG4gICAgICAgICAgICAgICAgICAgICAgICBhYm91dHNwYWNlLmNsYXNzTGlzdC5hZGQoJ2hpZGUnKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfSk7XG5cbiAgICAgICAgLy9tZW51IGV2ZW50IGxpc3RlbmVyXG4gICAgICAgIGFib3V0T3B0aW9uLmFkZEV2ZW50TGlzdGVuZXIoJ2NsaWNrJywgKGV2ZW50KSA9PiB7XG4gICAgICAgICAgICBsZXQgdGFyZ2V0ID0gZXZlbnQudGFyZ2V0LnF1ZXJ5U2VsZWN0b3IoJ1tkYXRhLXRhc2tdJykgfHwgZXZlbnQudGFyZ2V0OyAvL3NoYWRvdyBET00gYWNjZXNzaWJpbGl0eSBpc3N1ZXNcbiAgICAgICAgICAgIGxldCB0YXNrID0gdGFyZ2V0LmdldEF0dHJpYnV0ZSgnZGF0YS10YXNrJyk7XG4gICAgICAgICAgICBpZiAodGFzaykge1xuICAgICAgICAgICAgICAgIHN3aXRjaCAodGFzaykge1xuICAgICAgICAgICAgICAgICAgICBjYXNlICdhYm91dCc6XG4gICAgICAgICAgICAgICAgICAgICAgICBnYW1lc3BhY2UuY2xhc3NMaXN0LmFkZCgnaGlkZScpO1xuICAgICAgICAgICAgICAgICAgICAgICAgaGlnaHNjb3Jlc3BhY2UuY2xhc3NMaXN0LmFkZCgnaGlkZScpO1xuICAgICAgICAgICAgICAgICAgICAgICAgYWJvdXRzcGFjZS5jbGFzc0xpc3QucmVtb3ZlKCdoaWRlJyk7XG4gICAgICAgICAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH0pO1xuXG4gICAgICAgIC8vYm9hcmQgc2l6ZSBldmVudCBsaXN0ZW5lclxuICAgICAgICB0aGlzLmFkZEV2ZW50TGlzdGVuZXIoJ2NsaWNrJywgKGV2ZW50KSA9PiB7XG4gICAgICAgICAgICBsZXQgdGFyZ2V0ID0gZXZlbnQucGF0aFswXTtcbiAgICAgICAgICAgIGlmICh0YXJnZXQuZ2V0QXR0cmlidXRlKCdib2FyZHNpemUnKSkge1xuICAgICAgICAgICAgICAgIHRoaXMudXNlciA9IHRoaXMuc2hhZG93Um9vdC5xdWVyeVNlbGVjdG9yKCcjaW50cm8gaW5wdXQnKS52YWx1ZSB8fCAnc3RyYW5nZXInOyAvL2dldCB0aGUgbmFtZSB3aGVuIGJvYXJkIHNpemUgaXMgY2hvc2VuXG4gICAgICAgICAgICAgICAgc3dpdGNoICh0YXJnZXQuZ2V0QXR0cmlidXRlKCdib2FyZHNpemUnKSkge1xuICAgICAgICAgICAgICAgICAgICBjYXNlICc0NCc6XG4gICAgICAgICAgICAgICAgICAgICAgICBnYW1lLndpZHRoID0gNDtcbiAgICAgICAgICAgICAgICAgICAgICAgIGdhbWUuaGVpZ2h0ID0gNDtcbiAgICAgICAgICAgICAgICAgICAgICAgIGdhbWUuZHJhdygpO1xuICAgICAgICAgICAgICAgICAgICAgICAgZ2FtZS5wbGF5KCk7XG4gICAgICAgICAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgICAgICAgICAgY2FzZSAnNDInOlxuICAgICAgICAgICAgICAgICAgICAgICAgZ2FtZS53aWR0aCA9IDQ7XG4gICAgICAgICAgICAgICAgICAgICAgICBnYW1lLmhlaWdodCA9IDI7XG4gICAgICAgICAgICAgICAgICAgICAgICBnYW1lLmRyYXcoKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGdhbWUucGxheSgpO1xuICAgICAgICAgICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICAgICAgICAgIGNhc2UgJzI0JzpcbiAgICAgICAgICAgICAgICAgICAgICAgIGdhbWUud2lkdGggPSAyO1xuICAgICAgICAgICAgICAgICAgICAgICAgZ2FtZS5oZWlnaHQgPSA0O1xuICAgICAgICAgICAgICAgICAgICAgICAgZ2FtZS5kcmF3KCk7XG4gICAgICAgICAgICAgICAgICAgICAgICBnYW1lLnBsYXkoKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfSk7XG5cbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBSdW5zIHdoZW4gYXBwIGlzIHJlbW92ZWQgZnJvbSB0aGUgRE9NLlxuICAgICAqIENsb3NlcyB0aGUgd2luZG93LlxuICAgICAqL1xuICAgIGRpc2Nvbm5lY3RlZENhbGxiYWNrKCkge1xuICAgICAgICB0aGlzLmNsb3NlKCk7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogVXBkYXRlcyBoaWdoc2NvcmVzIGJ5IHNldHRpbmcgdGhlbSBpbiB0aGUgbG9jYWwgc3RvcmFnZVxuICAgICAqIGFuZCBkaXNwbGF5aW5nIGRlbS5cbiAgICAgKiBAcGFyYW0gcmVzdWx0XG4gICAgICovXG4gICAgdXBkYXRlSGlnaHNjb3JlcyhyZXN1bHQpIHtcbiAgICAgICAgbGV0IGhpZ2hzY29yZXNUZW1wbGF0ZSA9IGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3IoJ2xpbmtbaHJlZj1cIi9tZW1vcnktYXBwLmh0bWxcIl0nKS5pbXBvcnQucXVlcnlTZWxlY3RvcihcIiNoaWdoc2NvcmVzVGVtcGxhdGVcIik7XG5cbiAgICAgICAgbGV0IGhpZ2hzY29yZXMgPSB7XG4gICAgICAgICAgICBzdG9yYWdlOiBsb2NhbFN0b3JhZ2UsXG4gICAgICAgICAgICBzY29yZXM6IHVuZGVmaW5lZCxcbiAgICAgICAgICAgIC8qKlxuICAgICAgICAgICAgICogUmV0cmlldmVzIGhpZ2hzY29yZXMgZnJvbSBsb2NhbCBzdG9yYWdlXG4gICAgICAgICAgICAgKiBAcmV0dXJucyB7T2JqZWN0fSB0aGUgaGlnaHNjb3JlLWxpc3QsIG9yIHVuZGVmaW5lZCBpZiB0aGVyZSBhcmUgbm8gaGlnaHNjb3Jlc1xuICAgICAgICAgICAgICovXG4gICAgICAgICAgICBnZXRIaWdoU2NvcmVzOiBmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICAgICAgaWYgKHRoaXMuc3RvcmFnZS5tZW1vcnlIaWdoU2NvcmVzKSB7XG4gICAgICAgICAgICAgICAgICAgIHRoaXMuc2NvcmVzID0gSlNPTi5wYXJzZSh0aGlzLnN0b3JhZ2UubWVtb3J5SGlnaFNjb3Jlcyk7XG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgcmV0dXJuIHRoaXMuc2NvcmVzO1xuICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIC8qKlxuICAgICAgICAgICAgICogc2V0cyBoaWdoc2NvcmVzIGluIGxvY2FsIHN0b3JhZ2VcbiAgICAgICAgICAgICAqIEBwYXJhbSB1c2VyIHtzdHJpbmd9IHRoZSB1c2VycyBuYW1lXG4gICAgICAgICAgICAgKiBAcGFyYW0gbmV3U2NvcmUge251bWJlcn0gdGhlIHNjb3JlIHRvIHNldFxuICAgICAgICAgICAgICovXG4gICAgICAgICAgICBzZXRIaWdoU2NvcmVzOiBmdW5jdGlvbiAodXNlciwgbmV3U2NvcmUpIHtcbiAgICAgICAgICAgICAgICBsZXQgb2xkSGlnaFNjb3JlcztcbiAgICAgICAgICAgICAgICBsZXQgbmV3SGlnaFNjb3JlcztcblxuICAgICAgICAgICAgICAgIGlmICh0aGlzLnN0b3JhZ2UubWVtb3J5SGlnaFNjb3Jlcykge1xuICAgICAgICAgICAgICAgICAgICBvbGRIaWdoU2NvcmVzID0gSlNPTi5wYXJzZSh0aGlzLnN0b3JhZ2UubWVtb3J5SGlnaFNjb3Jlcyk7XG4gICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgb2xkSGlnaFNjb3JlcyA9IFtdO1xuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIG9sZEhpZ2hTY29yZXMucHVzaCh7dXNlcjogdXNlciwgc2NvcmU6IG5ld1Njb3JlfSk7XG5cbiAgICAgICAgICAgICAgICBuZXdIaWdoU2NvcmVzID0gb2xkSGlnaFNjb3Jlcy5zb3J0KChhLCBiKSA9PiB7IC8vc29ydFxuICAgICAgICAgICAgICAgICAgICByZXR1cm4gYS5zY29yZSAtIGIuc2NvcmU7XG4gICAgICAgICAgICAgICAgfSk7XG5cbiAgICAgICAgICAgICAgICBpZiAobmV3SGlnaFNjb3Jlcy5sZW5ndGggPiA1KSB7IC8va2VlcCB0aGUgbGlzdCB0byA1IHNjb3Jlc1xuICAgICAgICAgICAgICAgICAgICBuZXdIaWdoU2NvcmVzLmxlbmd0aCA9IDU7XG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgdGhpcy5zdG9yYWdlLm1lbW9yeUhpZ2hTY29yZXMgPSBKU09OLnN0cmluZ2lmeShuZXdIaWdoU2NvcmVzKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfTtcblxuICAgICAgICBpZiAocmVzdWx0KSB7IC8vYSBuZXcgcmVzdWx0IGlzIHByZXNlbnRcbiAgICAgICAgICAgIGxldCBzY29yZSA9IChyZXN1bHQudHVybnMgKiByZXN1bHQudGltZSkgLyAodGhpcy5zaGFkb3dSb290LnF1ZXJ5U2VsZWN0b3IoJ21lbW9yeS1nYW1lJykuaGVpZ2h0ICogdGhpcy5zaGFkb3dSb290LnF1ZXJ5U2VsZWN0b3IoJ21lbW9yeS1nYW1lJykud2lkdGgpO1xuICAgICAgICAgICAgaGlnaHNjb3Jlcy5zZXRIaWdoU2NvcmVzKHRoaXMudXNlciwgc2NvcmUpO1xuICAgICAgICAgICAgdGhpcy5zaGFkb3dSb290LnF1ZXJ5U2VsZWN0b3IoJ21lbW9yeS1nYW1lJykucmVzdWx0ID0gdW5kZWZpbmVkOyAvL2NsZWFuIHRoZSByZXN1bHRcbiAgICAgICAgfVxuXG4gICAgICAgIC8vZGlzcGxheSB0aGUgc2NvcmVzXG4gICAgICAgIGxldCBzY29yZXMgPSBoaWdoc2NvcmVzLmdldEhpZ2hTY29yZXMoKTtcbiAgICAgICAgbGV0IGhpZ2hzY29yZURpc3BsYXkgPSB0aGlzLnNoYWRvd1Jvb3QucXVlcnlTZWxlY3RvcignI2hpZ2hzY29yZURpc3BsYXknKTtcbiAgICAgICAgbGV0IG9sZExpc3QgPSBoaWdoc2NvcmVEaXNwbGF5LnF1ZXJ5U2VsZWN0b3IoJ3VsJyk7XG4gICAgICAgIGxldCBsaXN0ID0gZG9jdW1lbnQuaW1wb3J0Tm9kZShoaWdoc2NvcmVzVGVtcGxhdGUuY29udGVudC5xdWVyeVNlbGVjdG9yKFwidWxcIiksIHRydWUpO1xuICAgICAgICBsZXQgZW50cnk7XG5cbiAgICAgICAgaWYgKHNjb3Jlcykge1xuICAgICAgICAgICAgc2NvcmVzLmZvckVhY2goKHNjb3JlKSA9PiB7XG4gICAgICAgICAgICAgICAgZW50cnkgPSBkb2N1bWVudC5pbXBvcnROb2RlKChsaXN0LnF1ZXJ5U2VsZWN0b3IoXCJsaVwiKSkpO1xuICAgICAgICAgICAgICAgIGVudHJ5LnRleHRDb250ZW50ID0gc2NvcmUudXNlciArIFwiOiBcIiArIHNjb3JlLnNjb3JlO1xuICAgICAgICAgICAgICAgIGxpc3QuYXBwZW5kQ2hpbGQoZW50cnkpO1xuICAgICAgICAgICAgfSk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBlbnRyeSA9IGRvY3VtZW50LmltcG9ydE5vZGUoKGxpc3QucXVlcnlTZWxlY3RvcihcImxpXCIpKSk7XG4gICAgICAgICAgICBlbnRyeS50ZXh0Q29udGVudCA9IFwiLVwiO1xuICAgICAgICAgICAgbGlzdC5hcHBlbmRDaGlsZChlbnRyeSk7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAoIW9sZExpc3QpIHsgLy9pZiBzY29yZXMgaGF2ZSBhbHJlYWR5IGJlZW4gZGlzcGxheWVkLCByZXBsYWNlIHRoZW1cbiAgICAgICAgICAgIGhpZ2hzY29yZURpc3BsYXkuYXBwZW5kQ2hpbGQobGlzdCk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBoaWdoc2NvcmVEaXNwbGF5LnJlcGxhY2VDaGlsZChsaXN0LCBvbGRMaXN0KTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIC8qKlxuICAgICAqIEByZXR1cm5zIHRydWUgaWYgdGhlIHdpbmRvdyBjb250YWluaW5nIHRoZSBhcHAgaXMgb3Blbi5cbiAgICAgKi9cbiAgICBnZXQgb3BlbigpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuc2hhZG93Um9vdC5xdWVyeVNlbGVjdG9yKCdkcmFnZ2FibGUtd2luZG93Jykub3BlbjtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBAcmV0dXJucyB0cnVlIGlmIHRoZSB3aW5kb3cgY29udGFpbmluZyB0aGUgYXBwIGlzIG1pbmltaXplZC5cbiAgICAgKi9cbiAgICBnZXQgbWluaW1pemVkKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5zaGFkb3dSb290LnF1ZXJ5U2VsZWN0b3IoJ2RyYWdnYWJsZS13aW5kb3cnKS5taW5pbWl6ZWQ7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogU2V0cyB0aGUgbWluaW1pemVkIHByb3BlcnR5IG9mIHRoZSB3aW5kb3cgY29udGFpbmluZyB0aGUgYXBwLlxuICAgICAqIEBwYXJhbSBtaW5pbWl6ZSB7Ym9vbGVhbn0gd2hldGhlciB0byBtaW5pbWl6ZVxuICAgICAqL1xuICAgIHNldCBtaW5pbWl6ZWQobWluaW1pemUpIHtcbiAgICAgICAgdGhpcy5zaGFkb3dSb290LnF1ZXJ5U2VsZWN0b3IoJ2RyYWdnYWJsZS13aW5kb3cnKS5taW5pbWl6ZWQgPSBtaW5pbWl6ZTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBSZW1vdmVzIHRoZSBub2RlIGFuZCBjbG9zZXMgdGhlIHdpbmRvdy5cbiAgICAgKi9cbiAgICBjbG9zZSgpIHtcbiAgICAgICAgdGhpcy5wYXJlbnROb2RlLnJlbW92ZUNoaWxkKHRoaXMpO1xuICAgICAgICB0aGlzLnNoYWRvd1Jvb3QucXVlcnlTZWxlY3RvcignZHJhZ2dhYmxlLXdpbmRvdycpLmNsb3NlKCk7XG4gICAgfVxuXG59XG5cbi8vaGVscGVyIGZ1bmN0aW9uXG4vL2FkZHMgbXVsdGlwbGUgZXZlbnQgbGlzdGVuZXJzIHdpdGggaWRlbnRpY2FsIGhhbmRsZXJzXG5mdW5jdGlvbiBhZGRFdmVudExpc3RlbmVycyhlbGVtZW50LCBldmVudHMsIGhhbmRsZXIpIHtcbiAgICBldmVudHMuc3BsaXQoJyAnKS5mb3JFYWNoKGV2ZW50ID0+IGVsZW1lbnQuYWRkRXZlbnRMaXN0ZW5lcihldmVudCwgaGFuZGxlcikpO1xufVxuXG4vL2RlZmluZSB0aGUgZWxlbWVudFxuY3VzdG9tRWxlbWVudHMuZGVmaW5lKCdtZW1vcnktYXBwJywgTWVtb3J5QXBwKTtcbiIsIi8qXG4gKiBBIG1vZHVsZSBmb3IgYSBjdXN0b20gSFRNTCBlbGVtZW50IG1lbW9yeS1nYW1lIHRvIGZvcm0gcGFydCBvZiBhIHdlYiBjb21wb25lbnQuXG4gKiBJdCBjcmVhdGVzIGEgbWVtb3J5IGdhbWUgd2l0aCBhIHRpbWVyIGEgYSB0dXJuLWNvdW50ZXIuIFRoZSBnYW1lIGlzIG92ZXIgd2hlblxuICogYWxsIGJyaWNrcyBoYXZlIGJlZW4gcGFpcmVkIGFuZCBzdG9yZXMgdGhlIHRvdGFsIHRpbWUgYW5kIHR1cm5zIGluIGEgcmVzdWx0LXZhcmlhYmxlLlxuICogQGF1dGhvciBNb2xseSBBcmhhbW1hclxuICogQHZlcnNpb24gMS4wLjBcbiAqXG4gKi9cblxuLy9yZXF1aXJlc1xubGV0IFRpbWVyID0gcmVxdWlyZSgnLi90aW1lci5qcycpO1xuXG5cbmNsYXNzIE1lbW9yeUdhbWUgZXh0ZW5kcyBIVE1MRWxlbWVudCB7XG4gICAgLyoqXG4gICAgICogSW5pdGlhdGVzIGEgbWVtb3J5IGdhbWUsIHNldHMgdXAgc2hhZG93IERPTS5cbiAgICAgKi9cbiAgICBjb25zdHJ1Y3Rvcih3aWR0aCwgaGVpZ2h0KSB7XG4gICAgICAgIHN1cGVyKCk7XG4gICAgICAgIGxldCBtZW1vcnlUZW1wbGF0ZSA9IGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3IoJ2xpbmtbaHJlZj1cIi9tZW1vcnktYXBwLmh0bWxcIl0nKS5pbXBvcnQucXVlcnlTZWxlY3RvcignbGlua1tocmVmPVwiL21lbW9yeS1nYW1lLmh0bWxcIl0nKS5pbXBvcnQucXVlcnlTZWxlY3RvcihcIiNtZW1vcnlUZW1wbGF0ZVwiKTsgLy9zaGFkb3cgRE9NIGltcG9ydFxuXG4gICAgICAgIC8vc2V0dXAgc2hhZG93IGRvbSBzdHlsZXNcbiAgICAgICAgbGV0IHNoYWRvd1Jvb3QgPSB0aGlzLmF0dGFjaFNoYWRvdyh7bW9kZTogXCJvcGVuXCJ9KTtcbiAgICAgICAgbGV0IGluc3RhbmNlID0gbWVtb3J5VGVtcGxhdGUuY29udGVudC5jbG9uZU5vZGUodHJ1ZSk7XG4gICAgICAgIHNoYWRvd1Jvb3QuYXBwZW5kQ2hpbGQoaW5zdGFuY2UpO1xuXG4gICAgICAgIC8vc2V0IHdpZHRoIGFuZCBoZWlnaHQgYXR0cmlidXRlc1xuICAgICAgICB0aGlzLnNldEF0dHJpYnV0ZSgnZGF0YS13aWR0aCcsIHdpZHRoIHx8IHRoaXMuZ2V0QXR0cmlidXRlKCdkYXRhLXdpZHRoJykgfHwgNCk7XG4gICAgICAgIHRoaXMuc2V0QXR0cmlidXRlKCdkYXRhLWhlaWdodCcsIGhlaWdodCB8fCB0aGlzLmdldEF0dHJpYnV0ZSgnZGF0YS1oZWlnaHQnKSAgfHwgNCk7XG5cbiAgICAgICAgLy9zZXQgcmVmZXJlbmNlc1xuICAgICAgICB0aGlzLnNldCA9IFtdO1xuICAgICAgICB0aGlzLnRpbWVyID0gbmV3IFRpbWVyKDApO1xuICAgICAgICB0aGlzLmdhbWVQbGF5ID0gdW5kZWZpbmVkO1xuICAgICAgICB0aGlzLnRpbWVzcGFuID0gdGhpcy5zaGFkb3dSb290LnF1ZXJ5U2VsZWN0b3IoXCIjdGltZXNwYW5cIik7XG4gICAgICAgIHRoaXMudHVybnNwYW4gPSB0aGlzLnNoYWRvd1Jvb3QucXVlcnlTZWxlY3RvcihcIiN0dXJuc3BhblwiKTtcblxuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFJ1bnMgd2hlbiBtZW1vcnkgaXMgaW5zZXJ0ZWQgaW50byB0aGUgRE9NLlxuICAgICAqIEFkZHMgZXZlbnQgbGlzdGVuZXJzIGFuZCByZW5kZXJzIGEgYm9hcmQgd2l0aCBicmlja3MuXG4gICAgICovXG4gICAgY29ubmVjdGVkQ2FsbGJhY2soKSB7XG4gICAgICAgIHRoaXMuc2hhZG93Um9vdC5xdWVyeVNlbGVjdG9yKCcjaW50cm8gYnV0dG9uJykuYWRkRXZlbnRMaXN0ZW5lcignY2xpY2snLCAoZXZlbnQpID0+IHtcbiAgICAgICAgICAgIHRoaXMucGxheSgpO1xuICAgICAgICB9KTtcblxuICAgICAgICB0aGlzLmRyYXcoKTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBAcmV0dXJucyB7c3RyaW5nfSB0aGUgd2lkdGggb2YgdGhlIGJvYXJkIGluIGJyaWNrc1xuICAgICAqL1xuICAgIGdldCB3aWR0aCgpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuZ2V0QXR0cmlidXRlKCdkYXRhLXdpZHRoJyk7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogU2V0cyB0aGUgd2lkdGggb2YgdGhlIGJvYXJkIGluIGJyaWNrcy5cbiAgICAgKiBAcGFyYW0gbmV3VmFsIHtzdHJpbmd9IHRoZSBuZXcgd2lkdGggb2YgdGhlIGJvYXJkIGluIGJyaWNrc1xuICAgICAqL1xuICAgIHNldCB3aWR0aChuZXdWYWwpIHtcbiAgICAgICAgdGhpcy5zZXRBdHRyaWJ1dGUoJ2RhdGEtd2lkdGgnLCBuZXdWYWwpO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIEByZXR1cm5zIHtzdHJpbmd9IHRoZSBoZWlnaHQgb2YgdGhlIGJvYXJkIGluIGJyaWNrc1xuICAgICAqL1xuICAgIGdldCBoZWlnaHQoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLmdldEF0dHJpYnV0ZSgnZGF0YS1oZWlnaHQnKTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBTZXRzIHRoZSBoZWlnaHQgb2YgdGhlIGJvYXJkIGluIGJyaWNrcy5cbiAgICAgKiBAcGFyYW0gbmV3VmFsIHtzdHJpbmd9IHRoZSBuZXcgaGVpZ2h0IG9mIHRoZSBib2FyZCBpbiBicmlja3NcbiAgICAgKi9cbiAgICBzZXQgaGVpZ2h0KG5ld1ZhbCkge1xuICAgICAgICB0aGlzLnNldEF0dHJpYnV0ZSgnZGF0YS1oZWlnaHQnLCBuZXdWYWwpO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFNodWZmbGVzIHRoZSBicmlja3MgdXNpbmcgRmlzaGVyLVlhdGVzIGFsZ29yaXRobS5cbiAgICAgKi9cbiAgICBzaHVmZmxlKCkge1xuICAgICAgICBsZXQgdGhlU2V0ID0gdGhpcy5zZXQ7XG4gICAgICAgIGZvciAobGV0IGkgPSAodGhlU2V0Lmxlbmd0aCAtIDEpOyBpID4gMDsgaSAtPSAxKSB7XG4gICAgICAgICAgICBsZXQgaiA9IE1hdGguZmxvb3IoTWF0aC5yYW5kb20oKSAqIGkpO1xuICAgICAgICAgICAgbGV0IGlPbGQgPSB0aGVTZXRbaV07XG4gICAgICAgICAgICB0aGVTZXRbaV0gPSB0aGVTZXRbal07XG4gICAgICAgICAgICB0aGVTZXRbal0gPSBpT2xkO1xuICAgICAgICB9XG4gICAgICAgIHRoaXMuc2V0ID0gdGhlU2V0O1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIEFkZHMgdGhlIGJyaWNrcyB0byB0aGUgYm9hcmQgYW5kIHJlbmRlcnMgdGhlbSBpbiB0aGUgRE9NLlxuICAgICAqL1xuICAgIGRyYXcoKSB7XG4gICAgICAgIGxldCBicmlja1RlbXBsYXRlID0gZG9jdW1lbnQucXVlcnlTZWxlY3RvcignbGlua1tocmVmPVwiL21lbW9yeS1hcHAuaHRtbFwiXScpLmltcG9ydC5xdWVyeVNlbGVjdG9yKCdsaW5rW2hyZWY9XCIvbWVtb3J5LWdhbWUuaHRtbFwiXScpLmltcG9ydC5xdWVyeVNlbGVjdG9yKFwiI2JyaWNrVGVtcGxhdGVcIik7IC8vYnJpY2sgdGVtcGxhdGVcblxuICAgICAgICBsZXQgYnJpY2s7XG4gICAgICAgIGxldCBtYXRjaDtcbiAgICAgICAgbGV0IHBhaXJzID0gTWF0aC5yb3VuZCgodGhpcy53aWR0aCAqIHRoaXMuaGVpZ2h0KSkgLyAyO1xuICAgICAgICB0aGlzLnNldCA9IFtdO1xuICAgICAgICBsZXQgb2xkQnJpY2tzID0gdGhpcy5jaGlsZHJlbjtcblxuICAgICAgICAvL3JlbW92ZSBvbGQgYnJpY2tzIGlmIGFueVxuICAgICAgICBmb3IgKGxldCBpID0gb2xkQnJpY2tzLmxlbmd0aCAtMTsgaSA+PSAwOyBpIC09IDEpIHtcbiAgICAgICAgICAgIGxldCBicmljayA9IG9sZEJyaWNrc1tpXTtcbiAgICAgICAgICAgIGlmIChicmljay5nZXRBdHRyaWJ1dGUoJ3Nsb3QnKSA9PT0gJ2JyaWNrJykge1xuICAgICAgICAgICAgICAgIGJyaWNrLnBhcmVudE5vZGUucmVtb3ZlQ2hpbGQoYnJpY2spO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgLy9pbml0aWF0ZSBicmlja3NcbiAgICAgICAgZm9yIChsZXQgaSA9IDE7IGkgPD0gcGFpcnM7IGkgKz0gMSkge1xuICAgICAgICAgICAgYnJpY2sgPSBuZXcgQnJpY2soaSk7XG4gICAgICAgICAgICB0aGlzLnNldC5wdXNoKGJyaWNrKTtcbiAgICAgICAgICAgIG1hdGNoID0gYnJpY2suY2xvbmUoKTtcbiAgICAgICAgICAgIHRoaXMuc2V0LnB1c2gobWF0Y2gpO1xuICAgICAgICB9XG4gICAgICAgIGxldCB0aGVTZXQgPSB0aGlzLnNldDtcblxuICAgICAgICAvL3B1dCB0aGVtIGluIHRoZSBkb21cbiAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCB0aGVTZXQubGVuZ3RoOyBpICs9IDEpIHtcbiAgICAgICAgICAgIGxldCBicmlja0RpdiA9IGRvY3VtZW50LmltcG9ydE5vZGUoYnJpY2tUZW1wbGF0ZS5jb250ZW50LCB0cnVlKTtcbiAgICAgICAgICAgIGxldCBpbWcgPSBicmlja0Rpdi5xdWVyeVNlbGVjdG9yKFwiaW1nXCIpO1xuICAgICAgICAgICAgbGV0IGJyaWNrID0gdGhlU2V0W2ldO1xuICAgICAgICAgICAgaW1nLnNyYyA9ICcvaW1hZ2UvbWVtb3J5LWJyaWNrLScgKyBicmljay5kcmF3KCkgKyAnLnBuZyc7XG4gICAgICAgICAgICBpbWcuc2V0QXR0cmlidXRlKFwiYnJpY2tOdW1iZXJcIiwgaSk7XG4gICAgICAgICAgICB0aGlzLmFwcGVuZENoaWxkKGJyaWNrRGl2KTtcblxuICAgICAgICAgICAgaWYgKChpICsgMSkgJSB0aGlzLndpZHRoID09PSAwKSB7XG4gICAgICAgICAgICAgICAgbGV0IGJyID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudChcImJyXCIpO1xuICAgICAgICAgICAgICAgIGJyLnNldEF0dHJpYnV0ZSgnc2xvdCcsICdicmljaycpO1xuICAgICAgICAgICAgICAgIHRoaXMuYXBwZW5kQ2hpbGQoYnIpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogU3RhcnRzIGEgZ2FtZSwgcGxheXMgaXQgdGhyb3VnaCwgc2F2ZXMgdGhlIHJlc3VsdCBhbmRcbiAgICAgKiB0aGVuIGRpc3BsYXlzIHRoZSBvdXRyby5cbiAgICAgKi9cbiAgICBwbGF5KCkge1xuICAgICAgICB0aGlzLnNodWZmbGUoKTtcbiAgICAgICAgdGhpcy5zaGFkb3dSb290LnF1ZXJ5U2VsZWN0b3IoXCIjaW50cm9cIikuY2xhc3NMaXN0LmFkZCgnaGlkZScpO1xuICAgICAgICB0aGlzLnNoYWRvd1Jvb3QucXVlcnlTZWxlY3RvcihcIiNtYWluXCIpLmNsYXNzTGlzdC5yZW1vdmUoJ2hpZGUnKTtcbiAgICAgICAgdGhpcy5zaGFkb3dSb290LnF1ZXJ5U2VsZWN0b3IoXCIjb3V0cm9cIikuY2xhc3NMaXN0LmFkZCgnaGlkZScpO1xuICAgICAgICB0aGlzLnRpbWVyLnN0YXJ0KDApO1xuICAgICAgICB0aGlzLnRpbWVyLmRpc3BsYXkodGhpcy50aW1lc3Bhbik7XG4gICAgICAgIHBsYXlHYW1lKHRoaXMuc2V0LCB0aGlzKVxuICAgICAgICAgICAgLnRoZW4oKHJlc3VsdCkgPT4ge1xuICAgICAgICAgICAgICAgIHJlc3VsdC50aW1lID0gdGhpcy50aW1lci5zdG9wKCk7XG4gICAgICAgICAgICAgICAgdGhpcy5yZXN1bHQgPSByZXN1bHQ7XG4gICAgICAgICAgICAgICAgdGhpcy5zaGFkb3dSb290LnF1ZXJ5U2VsZWN0b3IoXCIjaW50cm9cIikuY2xhc3NMaXN0LmFkZCgnaGlkZScpO1xuICAgICAgICAgICAgICAgIHRoaXMuc2hhZG93Um9vdC5xdWVyeVNlbGVjdG9yKFwiI21haW5cIikuY2xhc3NMaXN0LmFkZCgnaGlkZScpO1xuICAgICAgICAgICAgICAgIHRoaXMuc2hhZG93Um9vdC5xdWVyeVNlbGVjdG9yKFwiI291dHJvXCIpLmNsYXNzTGlzdC5yZW1vdmUoJ2hpZGUnKTtcbiAgICAgICAgICAgIH0pO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFJlc3RhcnRzIHRoZSBnYW1lIHdpdGggdGhlIHNhbWUgc2l6ZSBvZiBib2FyZCB3aXRob3V0IHJlLXJlbmRlcmluZ1xuICAgICAqL1xuICAgIHJlcGxheSgpIHtcbiAgICAgICAgdGhpcy5yZXNldCgpO1xuICAgICAgICB0aGlzLnNoYWRvd1Jvb3QucXVlcnlTZWxlY3RvcihcIiNpbnRyb1wiKS5jbGFzc0xpc3QuYWRkKCdoaWRlJyk7XG4gICAgICAgIHRoaXMuc2hhZG93Um9vdC5xdWVyeVNlbGVjdG9yKFwiI21haW5cIikuY2xhc3NMaXN0LnJlbW92ZSgnaGlkZScpO1xuICAgICAgICB0aGlzLnNoYWRvd1Jvb3QucXVlcnlTZWxlY3RvcihcIiNvdXRyb1wiKS5jbGFzc0xpc3QuYWRkKCdoaWRlJyk7XG4gICAgICAgIHRoaXMucGxheSgpO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFJlc2V0cyB0aGUgZ2FtZSBhbmQgdGhlbiBsZXRzIHRoZSB1c2VyIGNob29zZSBhIG5ldyBnYW1lIHNpemUgYW5kXG4gICAgICogdXNlciBuYW1lLCByZS1yZW5kZXJpbmcgdGhlIGJvYXJkLlxuICAgICAqL1xuICAgIHJlc3RhcnQoKSB7XG4gICAgICAgIHRoaXMucmVzZXQoKTtcbiAgICAgICAgdGhpcy5zaGFkb3dSb290LnF1ZXJ5U2VsZWN0b3IoXCIjaW50cm9cIikuY2xhc3NMaXN0LnJlbW92ZSgnaGlkZScpO1xuICAgICAgICB0aGlzLnNoYWRvd1Jvb3QucXVlcnlTZWxlY3RvcihcIiNtYWluXCIpLmNsYXNzTGlzdC5hZGQoJ2hpZGUnKTtcbiAgICAgICAgdGhpcy5zaGFkb3dSb290LnF1ZXJ5U2VsZWN0b3IoXCIjb3V0cm9cIikuY2xhc3NMaXN0LmFkZCgnaGlkZScpO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFJlc2V0cyB0aGUgZ2FtZSB0byBtYWtlIGl0IHBsYXlhYmxlIGFnYWluLiBSZW1vdmVzIGV2ZW50IGxpc3RlbmVyc1xuICAgICAqIGFuZCB0dXJucyB0aGUgYnJpY2tzIG92ZXIuXG4gICAgICovXG4gICAgcmVzZXQoKSB7XG4gICAgICAgIGxldCBicmlja3MgPSB0aGlzLnF1ZXJ5U2VsZWN0b3JBbGwoJ1tzbG90PVwiYnJpY2tcIl0nKTtcbiAgICAgICAgQXJyYXkucHJvdG90eXBlLmZvckVhY2guY2FsbChicmlja3MsIChicmljaykgPT4ge1xuICAgICAgICAgICAgYnJpY2sucmVtb3ZlQXR0cmlidXRlKCdoaWRkZW4nKTtcbiAgICAgICAgICAgIGxldCBpbWcgPSBicmljay5xdWVyeVNlbGVjdG9yKFwiaW1nXCIpO1xuICAgICAgICAgICAgaWYgKGltZykge1xuICAgICAgICAgICAgICAgIGxldCBicmlja051bWJlciA9IGltZy5nZXRBdHRyaWJ1dGUoXCJicmlja051bWJlclwiKTtcbiAgICAgICAgICAgICAgICBpZiAodGhpcy5zZXRbYnJpY2tOdW1iZXJdLmRyYXcoKSAhPT0gMCkgeyAvL3R1cm4gdGhlIGJyaWNrIG92ZXIgaWYgaXQncyBub3QgdHVybmVkXG4gICAgICAgICAgICAgICAgICAgIGltZy5zcmMgPSAnL2ltYWdlL21lbW9yeS1icmljay0nICsgdGhpcy5zZXRbYnJpY2tOdW1iZXJdLnR1cm4oKSArICcucG5nJztcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH0pO1xuICAgICAgICB0aGlzLnRpbWVzcGFuLnRleHRDb250ZW50ID0gJyc7XG4gICAgICAgIHRoaXMudHVybnNwYW4udGV4dENvbnRlbnQgPSAnJztcbiAgICAgICAgdGhpcy50aW1lci5zdG9wKCk7IC8vbWFrZSBzdXJlIHRpbWVyIGlzIHN0b3BwZWRcbiAgICAgICAgdGhpcy5zaGFkb3dSb290LnF1ZXJ5U2VsZWN0b3IoJyNib2FyZCcpLnJlbW92ZUV2ZW50TGlzdGVuZXIoXCJjbGlja1wiLCB0aGlzLmdhbWVQbGF5KTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBFbmRzIHRoZSBnYW1lIGFuZCBkaXNwbGF5cyB0aGUgb3V0cm8uXG4gICAgICovXG4gICAgZW5kKCkge1xuICAgICAgICB0aGlzLnJlc2V0KCk7XG4gICAgICAgIHRoaXMuc2hhZG93Um9vdC5xdWVyeVNlbGVjdG9yKFwiI2ludHJvXCIpLmNsYXNzTGlzdC5hZGQoJ2hpZGUnKTtcbiAgICAgICAgdGhpcy5zaGFkb3dSb290LnF1ZXJ5U2VsZWN0b3IoXCIjbWFpblwiKS5jbGFzc0xpc3QuYWRkKCdoaWRlJyk7XG4gICAgICAgIHRoaXMuc2hhZG93Um9vdC5xdWVyeVNlbGVjdG9yKFwiI291dHJvXCIpLmNsYXNzTGlzdC5yZW1vdmUoJ2hpZGUnKTtcbiAgICB9XG59XG5cbi8vZGVmaW5lcyB0aGUgZWxlbWVudFxuY3VzdG9tRWxlbWVudHMuZGVmaW5lKCdtZW1vcnktZ2FtZScsIE1lbW9yeUdhbWUpO1xuXG5cbi8qKlxuICogQSBjbGFzcyBCcmljayB0byBnbyB3aXRoIHRoZSBtZW1vcnkgZ2FtZS5cbiAqL1xuY2xhc3MgQnJpY2sge1xuICAgIC8qKlxuICAgICAqIEluaXRpYXRlcyB0aGUgQnJpY2sgd2l0aCBhIHZhbHVlIGFuZCBwbGFjZXMgaXQgZmFjZWRvd24uXG4gICAgICogQHBhcmFtIG51bWJlciB7bnVtYmVyfSB0aGUgdmFsdWUgdG8gaW5pdGlhdGUuXG4gICAgICovXG4gICAgY29uc3RydWN0b3IobnVtYmVyKSB7XG4gICAgICAgIHRoaXMudmFsdWUgPSBudW1iZXI7XG4gICAgICAgIHRoaXMuZmFjZWRvd24gPSB0cnVlO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFR1cm5zIHRoZSBicmljayBhbmQgcmV0dXJucyB0aGUgdmFsdWUgYWZ0ZXIgdGhlIHR1cm4uXG4gICAgICogQHJldHVybnMge251bWJlcn0gdGhlIHZhbHVlIG9mIHRoZSBicmljayBpZiBpdCdzIGZhY2V1cCwgb3RoZXJ3aXNlIDAuXG4gICAgICovXG4gICAgdHVybigpIHtcbiAgICAgICAgdGhpcy5mYWNlZG93biA9ICEodGhpcy5mYWNlZG93bik7XG4gICAgICAgIHJldHVybiB0aGlzLmRyYXcoKTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBDb21wYXJlcyB0d28gYnJpY2tzLlxuICAgICAqIEBwYXJhbSBvdGhlciB7QnJpY2t9IHRoZSBCcmljayB0byBjb21wYXJlLlxuICAgICAqIEByZXR1cm5zIHtib29sZWFufSB0cnVlIGlmIHRoZSBicmlja3MgdmFsdWVzIGFyZSBlcXVhbC5cbiAgICAgKi9cbiAgICBlcXVhbHMob3RoZXIpIHtcbiAgICAgICAgcmV0dXJuIChvdGhlciBpbnN0YW5jZW9mIEJyaWNrKSAmJiAodGhpcy52YWx1ZSA9PT0gb3RoZXIudmFsdWUpO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIENsb25lcyB0aGUgYnJpY2suXG4gICAgICogQHJldHVybnMge0JyaWNrfSB0aGUgY2xvbmUuXG4gICAgICovXG4gICAgY2xvbmUoKSB7XG4gICAgICAgIHJldHVybiBuZXcgQnJpY2sodGhpcy52YWx1ZSk7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogQHJldHVybnMge251bWJlcn0gdGhlIGJyaWNrJ3MgdmFsdWUsIG9yIDAgaWYgaXQgaXMgZmFjZSBkb3duLlxuICAgICAqL1xuICAgIGRyYXcoKSB7XG4gICAgICAgIGlmICh0aGlzLmZhY2Vkb3duKSB7XG4gICAgICAgICAgICByZXR1cm4gMDtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHJldHVybiB0aGlzLnZhbHVlO1xuICAgICAgICB9XG4gICAgfVxufVxuXG4vKipcbiAqIEEgZnVuY3Rpb24gdGhhdCBzZXRzIHVwIHRoZSBnYW1lcGxheS4gQWRkcyBhbmQgcmVtb3ZlcyBldmVudC1saXN0ZW5lcnMgc28gdGhhdCB0aGUgc2FtZSBnYW1lIGNhbiBiZSByZXNldC5cbiAqIEBwYXJhbSBzZXQgW3tCcmlja119IHRoZSBzZXQgb2YgYnJpY2tzIHRvIHBsYXkgd2l0aC5cbiAqIEBwYXJhbSBnYW1lIHtub2RlfSB0aGUgc3BhY2UgdG8gcGxheVxuICogQHJldHVybnMge1Byb21pc2V9IGEgcHJvbWlzZSB0aGF0IHJlc29sdmVzIHdpdGggdGhlIHJlc3VsdCBvZiB0aGUgZ2FtZSB3aGVuIHRoZSBnYW1lIGhhcyBiZWVuIHBsYXllZC5cbiAqL1xuZnVuY3Rpb24gcGxheUdhbWUoc2V0LCBnYW1lKSB7XG4gICAgbGV0IHR1cm5zID0gMDtcbiAgICBsZXQgYnJpY2tzID0gcGFyc2VJbnQoZ2FtZS53aWR0aCkgKiBwYXJzZUludChnYW1lLmhlaWdodCk7XG4gICAgbGV0IGJvYXJkID0gZ2FtZS5zaGFkb3dSb290LnF1ZXJ5U2VsZWN0b3IoJyNib2FyZCcpO1xuICAgIGxldCBicmlja3NMZWZ0ID0gYnJpY2tzO1xuICAgIGxldCBjaG9pY2UxO1xuICAgIGxldCBjaG9pY2UyO1xuICAgIGxldCBpbWcxO1xuICAgIGxldCBpbWcyO1xuXG4gICAgcmV0dXJuIG5ldyBQcm9taXNlKChyZXNvbHZlLCByZWplY3QpID0+IHtcbiAgICAgICAgZ2FtZS5nYW1lUGxheSA9IGZ1bmN0aW9uKGV2ZW50KSB7IC8vZXhwb3NlIHRoZSByZWZlcmVuY2Ugc28gdGhlIGV2ZW50IGxpc3RlbmVyIGNhbiBiZSByZW1vdmVkIGZyb20gb3V0c2lkZSB0aGUgZnVuY3Rpb25cbiAgICAgICAgICAgIGlmICghY2hvaWNlMikgeyAvL2lmIHR3byBicmlja3MgYXJlIG5vdCB0dXJuZWRcbiAgICAgICAgICAgICAgICBsZXQgaW1nID0gZXZlbnQudGFyZ2V0LnF1ZXJ5U2VsZWN0b3IoXCJpbWdcIikgfHwgZXZlbnQudGFyZ2V0O1xuICAgICAgICAgICAgICAgIGxldCBicmlja051bWJlciA9IGltZy5nZXRBdHRyaWJ1dGUoXCJicmlja051bWJlclwiKTtcbiAgICAgICAgICAgICAgICBpZiAoIWJyaWNrTnVtYmVyKSB7IC8vdGFyZ2V0IGlzIG5vdCBhIGJyaWNrXG4gICAgICAgICAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICBsZXQgYnJpY2sgPSBzZXRbYnJpY2tOdW1iZXJdO1xuICAgICAgICAgICAgICAgIGltZy5zcmMgPSAnL2ltYWdlLycgKyBicmljay50dXJuKCkgKyAnLnBuZyc7XG5cbiAgICAgICAgICAgICAgICBpZiAoIWNob2ljZTEpIHsgLy9maXJzdCBicmljayB0byBiZSB0dXJuZWRcbiAgICAgICAgICAgICAgICAgICAgaW1nMSA9IGltZztcbiAgICAgICAgICAgICAgICAgICAgY2hvaWNlMSA9IGJyaWNrO1xuICAgICAgICAgICAgICAgIH0gZWxzZSB7IC8vc2Vjb25kIGJyaWNrIHRvIGJlIHR1cm5lZFxuICAgICAgICAgICAgICAgICAgICBpbWcyID0gaW1nO1xuICAgICAgICAgICAgICAgICAgICBjaG9pY2UyID0gYnJpY2s7XG5cbiAgICAgICAgICAgICAgICAgICAgaWYgKGNob2ljZTEuZXF1YWxzKGNob2ljZTIpICYmIGltZzEuZ2V0QXR0cmlidXRlKCdicmlja051bWJlcicpICE9PSBpbWcyLmdldEF0dHJpYnV0ZSgnYnJpY2tOdW1iZXInKSkgeyAvL3RoZSB0d28gYnJpY2tzIGFyZSBlcXVhbCBidXQgbm90IHRoZSBzYW1lXG4gICAgICAgICAgICAgICAgICAgICAgICBpbWcxLnBhcmVudEVsZW1lbnQucGFyZW50RWxlbWVudC5zZXRBdHRyaWJ1dGUoJ2hpZGRlbicsICcnKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGltZzIucGFyZW50RWxlbWVudC5wYXJlbnRFbGVtZW50LnNldEF0dHJpYnV0ZSgnaGlkZGVuJywgJycpO1xuICAgICAgICAgICAgICAgICAgICAgICAgY2hvaWNlMSA9IFwiXCI7XG4gICAgICAgICAgICAgICAgICAgICAgICBjaG9pY2UyID0gXCJcIjtcbiAgICAgICAgICAgICAgICAgICAgICAgIGltZzEgPSBcIlwiO1xuICAgICAgICAgICAgICAgICAgICAgICAgaW1nMiA9IFwiXCI7XG4gICAgICAgICAgICAgICAgICAgICAgICBicmlja3NMZWZ0IC09IDI7XG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAoYnJpY2tzTGVmdCA9PT0gMCkgeyAvL2FsbCBicmlja3MgYXJlIHR1cm5lZFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHJlc29sdmUoe3R1cm5zOiB0dXJuc30pO1xuICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICB9IGVsc2UgeyAvL2JyaWNrcyBhcmUgbm90IHRoZSBzYW1lXG4gICAgICAgICAgICAgICAgICAgICAgICBzZXRUaW1lb3V0KCgpID0+IHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBpbWcxLnNyYyA9ICcvaW1hZ2UvJyArIGNob2ljZTEudHVybigpICsgJy5wbmcnO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGltZzIuc3JjID0gJy9pbWFnZS8nICsgY2hvaWNlMi50dXJuKCkgKyAnLnBuZyc7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgY2hvaWNlMSA9IFwiXCI7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgY2hvaWNlMiA9IFwiXCI7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgaW1nMSA9IFwiXCI7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgaW1nMiA9IFwiXCI7XG4gICAgICAgICAgICAgICAgICAgICAgICB9LCAxMDAwKTtcbiAgICAgICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgICAgIHR1cm5zICs9IDE7XG4gICAgICAgICAgICAgICAgICAgIGdhbWUudHVybnNwYW4udGV4dENvbnRlbnQgPSB0dXJucztcbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGV2ZW50LnByZXZlbnREZWZhdWx0KCk7XG5cbiAgICAgICAgfTtcblxuICAgICAgICBib2FyZC5hZGRFdmVudExpc3RlbmVyKFwiY2xpY2tcIiwgZ2FtZS5nYW1lUGxheSk7XG5cbiAgICB9KTtcblxufVxuIiwiLyoqXG4gKiBNb2R1bGUgZm9yIFRpbWVyLlxuICpcbiAqIEBhdXRob3IgTW9sbHkgQXJoYW1tYXJcbiAqIEB2ZXJzaW9uIDEuMC4wXG4gKi9cblxuY2xhc3MgVGltZXIge1xuICAgIC8qKlxuICAgICAqIEluaXRpYXRlcyBhIFRpbWVyLlxuICAgICAqIEBwYXJhbSBzdGFydFRpbWUge251bWJlcn0gd2hlcmUgdG8gc3RhcnQgY291bnRpbmcuXG4gICAgICovXG4gICAgY29uc3RydWN0b3Ioc3RhcnRUaW1lID0gMCkge1xuICAgICAgICB0aGlzLmNvdW50ID0gc3RhcnRUaW1lO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIEByZXR1cm5zIHtudW1iZXJ9IHRoZSBjb3VudFxuICAgICAqL1xuICAgIGdldCB0aW1lKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5jb3VudDtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBTZXRzIHRoZSB0aW1lIG9uIHRoZSB0aW1lci5cbiAgICAgKiBAcGFyYW0gbmV3VGltZSB7bnVtYmVyfSB0aGUgbmV3IHRpbWVcbiAgICAgKi9cbiAgICBzZXQgdGltZShuZXdUaW1lKSB7XG4gICAgICAgIHRoaXMuY291bnQgPSBuZXdUaW1lO1xuICAgIH1cbiAgICAvKipcbiAgICAgKiBzdGFydHMgdGhlIHRpbWVyLiBpbmNyZW1lbnRzIHRpbWUgZXZlcnkgMTAwIG1pbGxpc2Vjb25kcy5cbiAgICAgKiBAcGFyYW0gdGltZSB7bnVtYmVyfSB3aGF0IG51bWJlciB0byBzdGFydCBpdCBvbi5cbiAgICAgKi9cbiAgICBzdGFydCh0aW1lID0gdGhpcy50aW1lKSB7XG4gICAgICAgIHRoaXMuY291bnQgPSB0aW1lO1xuICAgICAgICB0aGlzLnRpbWVyID0gc2V0SW50ZXJ2YWwoKCkgPT4ge1xuICAgICAgICAgICAgdGhpcy5jb3VudCArPSAxMDA7XG4gICAgICAgIH0sIDEwMCk7XG4gICAgfVxuICAgIC8qKlxuICAgICAqIHN0YXJ0cyB0aGUgdGltZXIuIGRlY3JlbWVudHMgdGltZSBldmVyeSAxMDAgbWlsbGlzZWNvbmRzLlxuICAgICAqIEBwYXJhbSB0aW1lIHtudW1iZXJ9IHdoYXQgbnVtYmVyIHRvIHN0YXJ0IGl0IG9uLlxuICAgICAqL1xuICAgIGNvdW50ZG93bih0aW1lKSB7XG4gICAgICAgIHRoaXMuY291bnQgPSB0aW1lIHx8IHRoaXMuY291bnQ7XG4gICAgICAgIHRoaXMudGltZXIgPSBzZXRJbnRlcnZhbCgoKSA9PiB7XG4gICAgICAgICAgICB0aGlzLmNvdW50IC09IDEwMDtcbiAgICAgICAgfSwgMTAwKTtcbiAgICB9XG4gICAgLyoqXG4gICAgICogc3RvcHMgdGhlIFRpbWVyLlxuICAgICAqIEByZXR1cm5zIHRoZSBjb3VudC5cbiAgICAgKi9cbiAgICBzdG9wKCkge1xuICAgICAgICBjbGVhckludGVydmFsKHRoaXMudGltZXIpO1xuICAgICAgICBjbGVhckludGVydmFsKHRoaXMuZGlzcGxheUludGVydmFsKTtcbiAgICAgICAgcmV0dXJuIHRoaXMuY291bnQ7XG4gICAgfVxuICAgIC8qKlxuICAgICAqIERpc3BsYXlzIGEgcm91bmRlZCB2YWx1ZSBvZiB0aGUgY291bnQgb2YgdGhlIHRpbWVyXG4gICAgICogdG8gdGhlIGRlc2lyZWQgcHJlY2lzaW9uLCBhdCBhbiBpbnRlcnZhbC5cbiAgICAgKiBAcGFyYW0gZGVzdGluYXRpb24ge25vZGV9IHdoZXJlIHRvIG1ha2UgdGhlIGRpc3BsYXlcbiAgICAgKiBAcGFyYW0gaW50ZXJ2YWwge251bWJlcn0gdGhlIGludGVydmFsIHRvIG1ha2UgdGhlIGRpc3BsYXkgaW4sIGluIG1pbGxpc2Vjb25kc1xuICAgICAqIEBwYXJhbSBwcmVjaXNpb24ge251bWJlcn10aGUgbnVtYmVyIHRvIGRpdmlkZSB0aGUgZGlzcGxheWVkIG1pbGxpc2Vjb25kcyBieVxuICAgICAqIEByZXR1cm5zIHRoZSBpbnRlcnZhbC5cbiAgICAgKlxuICAgICAqL1xuICAgIGRpc3BsYXkoZGVzdGluYXRpb24sIGludGVydmFsID0gMTAwLCBwcmVjaXNpb24gPSAxMDAwKSB7XG4gICAgICAgIHRoaXMuZGlzcGxheUludGVydmFsID0gc2V0SW50ZXJ2YWwoICgpPT4ge1xuICAgICAgICAgICAgZGVzdGluYXRpb24udGV4dENvbnRlbnQgPSBNYXRoLnJvdW5kKHRoaXMuY291bnQgLyBwcmVjaXNpb24pO1xuICAgICAgICB9LCBpbnRlcnZhbCk7XG4gICAgICAgIHJldHVybiB0aGlzLmRpc3BsYXlJbnRlcnZhbDtcbiAgICB9XG59XG5cbm1vZHVsZS5leHBvcnRzID0gVGltZXI7XG4iXX0=
