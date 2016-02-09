(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
var fastn = require('fastn')({
    _generic: require('fastn/genericComponent'),
    text: require('fastn/textComponent'),
    timePicker: require('./timePicker')
});

module.exports = function(settings) {
    return fastn('timePicker', settings).attach().render();
};

},{"./timePicker":94,"fastn":17,"fastn/genericComponent":16,"fastn/textComponent":33}],2:[function(require,module,exports){
var predator = require('predator');

// List of tagNames ordered by their likeliness to be the target of a click event
var clickableWeighting = ['button', 'a', 'label', 'h1', 'h2', 'h3', 'h4', 'i', 'span'];

var types = {
        'button': ['button', 'a'],
        'label': ['label', 'span', 'div'],
        'heading': ['h1', 'h2', 'h3', 'h4'],
        'image': ['img', 'svg'],
        'field': ['input', 'select'],
        'all': ['*']
    },
    noelementOfType = 'no elements of type ',
    documentScope,
    windowScope,
    runDelay,
    initialised;

function _pressKey(key, done) {
    var element = documentScope.activeElement;

    element.value += key;

    var keydownEvent = new windowScope.KeyboardEvent('keydown'),
        keyupEvent = new windowScope.KeyboardEvent('keyup'),
        pressKeyEvent = new windowScope.KeyboardEvent('pressKey');

    var method = 'initKeyboardEvent' in keydownEvent ? 'initKeyboardEvent' : 'initKeyEvent';

    keydownEvent[method]('keydown', true, true, windowScope, key, 3, true, false, true, false, false);
    keyupEvent[method]('keyup', true, true, windowScope, key, 3, true, false, true, false, false);
    pressKeyEvent[method]('pressKey', true, true, windowScope, key, 3, true, false, true, false, false);

    element.dispatchEvent(keydownEvent);
    element.dispatchEvent(keyupEvent);
    element.dispatchEvent(pressKeyEvent);

    done(null, element);
}

function _pressKeys(keys, done) {
    keys.split('').forEach(function(key) {
        _pressKey(key, function noop() {});
    });

    done(null, documentScope.activeElement);
}

function findUi(selectors) {
    return documentScope.querySelectorAll(selectors);
}

function _navigate(location, previousElement, done) {
    var callbackTimer;

    function handlewindowScopeError(error) {
        clearTimeout(callbackTimer);

        done(error);
        windowScope.removeEventListener('error', handlewindowScopeError);
    }

    windowScope.addEventListener('error', handlewindowScopeError);
    windowScope.location = location;

    callbackTimer = setTimeout(done, 150);
}

function _getLocation(done) {
    setTimeout(function() {
        done(null, windowScope.location);
    }, 500);
}

function matchElementValue(element, value) {
    return (
            element.textContent.toLowerCase() === value.toLowerCase() ||
            (element.title && element.title.toLowerCase() === value.toLowerCase())
        ) && !predator(element).hidden;
}

function findMatchingElements(value, type, elementsList) {
    return Array.prototype.slice.call(elementsList)
        .filter(function(element) {
            return matchElementValue(element, value);
        });
}

function _findUi(value, type, returnArray, done) {
    if(!done) {
        done = returnArray;
        returnArray = false;
    }

    var elementTypes = types[type];

    if(!elementTypes) {
        return done(new Error(type + ' is not a valid ui type'));
    }

    var elements = findUi(elementTypes);

    if(!elements.length) {
        return done(new Error(noelementOfType + type));
    }

    var result = findMatchingElements(value, type, elements);

    if(!result.length) {
        return done(new Error(noelementOfType + type + ' with value of ' + value));
    }

    done(null, returnArray ? result : result.shift());
}

function _setValue(value, element, done) {
    element.value = value;

    done(null, element);
}

function _wait(time, done) {
    setTimeout(done, time || 0);
}

function _click(element, done) {
    var rect = element.getBoundingClientRect(),
        clickElement = documentScope.elementFromPoint(rect.left, rect.top),
        elementInClickElement = ~Array.prototype.indexOf.call(clickElement.children, element);
    if
    (!elementInClickElement && (clickElement !== element)) {
        return done(new Error('no clickable element found'));
    }

    element.click();

    done(null, element);
}

function getElementClickWeight(element) {
    var index = clickableWeighting.indexOf(element.tagName.toLowerCase());
    return clickableWeighting.length - (index < 0 ? Infinity : index);
}

function executeClick(value, type, done) {
    _findUi(value, 'all', true, function(error, elements) {
        if(error) {
            return done(error);
        }

        var element = elements.sort(function(a, b) {
            return getElementClickWeight(a) < getElementClickWeight(b);
        }).shift();

        if(!element) {
            return done(new Error('could not find clickable element with value ' + value));
        }

        _click(element, done);
    });
}

function _focus(element, done) {
    element.focus();

    done(null, element);
}

function _changeValue(selector, type, value, done) {
    execute(_focus, selector, type, function(error, element) {
        _pressKeys(value, function(error){
            element.blur();

            var event = document.createEvent('HTMLEvents');

            event.initEvent('change', false, true);
            element.dispatchEvent(event);

            done(null, element);
        });
    });
}

function _blur(done) {
    var element = documentScope.activeElement;
    element.blur();

    done(null, element);
}

function execute(task, value, type, done) {
    _findUi(value, type, function(error, element) {
        if(error) {
            return done(error);
        }

        task(element, done);
    });
}

function runTasks(tasks, callback) {
    if(tasks.length) {
        tasks.shift()(function(error, result) {
            if(error) {
                return callback(error);
            } else {
                if(tasks.length === 0) {
                    callback(null, result);
                } else {
                    runTasks(tasks, callback);
                }
            }
        });
    }
}

function driveUi(){
    var tasks = [],
        driverFunctions = {};

    function addTask(task){
        tasks.push(task);

        return driverFunctions;
    }

    driverFunctions = {
        navigate: function(location){
            return addTask(_navigate.bind(driverFunctions, location));
        },
        findUi: function(value, type){
            return addTask(_findUi.bind(driverFunctions, value, type));
        },
        getLocation: function() {
            return addTask(_getLocation.bind(driverFunctions));
        },
        focus: function(value, type) {
            return addTask(execute.bind(driverFunctions, _focus, value, type));
        },
        blur: function() {
            return addTask(_blur.bind(driverFunctions));
        },
        click: function(value, type){
            return addTask(executeClick.bind(driverFunctions, value, type));
        },
        pressKey: function(value) {
            return addTask(_pressKey.bind(driverFunctions, value));
        },
        pressKeys: function(value) {
            return addTask(_pressKeys.bind(driverFunctions, value));
        },
        changeValue: function(selector, value, type) {
            return addTask(_changeValue.bind(driverFunctions, selector, value, type));
        },
        setValue: function(value) {
            return addTask(_setValue.bind(driverFunctions, value));
        },
        wait: function(time) {
            if(!arguments.length) {
                time = runDelay;
            }

            return addTask(_wait.bind(driverFunctions, time));
        },
        do: function(driver){
            return addTask(driver.go);
        },
        go: function(callback) {
            if(!initialised) {
                throw(new Error('init must becalled before calling go'));
            }

            if(tasks.length) {
                tasks.unshift(_wait.bind(driverFunctions, runDelay));
                runTasks(tasks, callback);
            } else {
                callback(new Error('No tasks defined'));
            }
        }
    };

    return driverFunctions;
}

driveUi.init = function(settings) {
    documentScope = settings.document || document;
    windowScope = settings.window || window;
    runDelay = settings.runDelay || 0;

    initialised = true;
};

module.exports = driveUi;

},{"predator":3}],3:[function(require,module,exports){
function findChildsExposedBox(child){
    var originalBounds = child.getBoundingClientRect(),
        parent = child.parentNode,
        parentOverflow,
        parentBounds,
        bounds;

    // Convert bounds object to pojo.
    bounds = {
        original: originalBounds,
        height: originalBounds.height,
        width: originalBounds.width,
        left: originalBounds.left,
        top: originalBounds.top,
        right: originalBounds.right,
        bottom: originalBounds.bottom
    };

    while(parent){
        if(parent === document){
            parentBounds = {
                top: 0,
                left: 0,
                bottom: window.innerHeight,
                right: window.innerWidth,
                height: window.innerHeight,
                width: window.innerWidth
            };
        }else{
            if(window.getComputedStyle(parent).overflow === 'visible'){
                parent = parent.offsetParent;
                continue;
            }
            parentBounds = parent.getBoundingClientRect();
        }

        if(parentBounds.top > bounds.top){
            bounds.height = bounds.height - (parentBounds.top - bounds.top);
            bounds.top = parentBounds.top;
        }
        if(parentBounds.left > bounds.left){
            bounds.width = bounds.width - (parentBounds.left - bounds.left);
            bounds.left = parentBounds.left;
        }
        if(parentBounds.right < bounds.right){
            bounds.width = bounds.width - (bounds.right - parentBounds.right);
            bounds.right = parentBounds.right;
        }
        if(parentBounds.bottom < bounds.bottom){
            bounds.height = bounds.height - (bounds.bottom - parentBounds.bottom);
            bounds.bottom = parentBounds.bottom;
        }

        if(bounds.width <= 0 || bounds.height <= 0){
            bounds.hidden = true;
            bounds.width = Math.max(bounds.width, 0);
            bounds.height = Math.max(bounds.height, 0);
            return bounds;
        }

        parent = parent.parentNode;
    }

    return bounds;
}

module.exports = findChildsExposedBox;
},{}],4:[function(require,module,exports){
//Copyright (C) 2012 Kory Nunn

//Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

//The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

//THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.

/*

    This code is not formatted for readability, but rather run-speed and to assist compilers.

    However, the code's intention should be transparent.

    *** IE SUPPORT ***

    If you require this library to work in IE7, add the following after declaring crel.

    var testDiv = document.createElement('div'),
        testLabel = document.createElement('label');

    testDiv.setAttribute('class', 'a');
    testDiv['className'] !== 'a' ? crel.attrMap['class'] = 'className':undefined;
    testDiv.setAttribute('name','a');
    testDiv['name'] !== 'a' ? crel.attrMap['name'] = function(element, value){
        element.id = value;
    }:undefined;


    testLabel.setAttribute('for', 'a');
    testLabel['htmlFor'] !== 'a' ? crel.attrMap['for'] = 'htmlFor':undefined;



*/

(function (root, factory) {
    if (typeof exports === 'object') {
        module.exports = factory();
    } else if (typeof define === 'function' && define.amd) {
        define(factory);
    } else {
        root.crel = factory();
    }
}(this, function () {
    var fn = 'function',
        obj = 'object',
        nodeType = 'nodeType',
        textContent = 'textContent',
        setAttribute = 'setAttribute',
        attrMapString = 'attrMap',
        isNodeString = 'isNode',
        isElementString = 'isElement',
        d = typeof document === obj ? document : {},
        isType = function(a, type){
            return typeof a === type;
        },
        isNode = typeof Node === fn ? function (object) {
            return object instanceof Node;
        } :
        // in IE <= 8 Node is an object, obviously..
        function(object){
            return object &&
                isType(object, obj) &&
                (nodeType in object) &&
                isType(object.ownerDocument,obj);
        },
        isElement = function (object) {
            return crel[isNodeString](object) && object[nodeType] === 1;
        },
        isArray = function(a){
            return a instanceof Array;
        },
        appendChild = function(element, child) {
          if(!crel[isNodeString](child)){
              child = d.createTextNode(child);
          }
          element.appendChild(child);
        };


    function crel(){
        var args = arguments, //Note: assigned to a variable to assist compilers. Saves about 40 bytes in closure compiler. Has negligable effect on performance.
            element = args[0],
            child,
            settings = args[1],
            childIndex = 2,
            argumentsLength = args.length,
            attributeMap = crel[attrMapString];

        element = crel[isElementString](element) ? element : d.createElement(element);
        // shortcut
        if(argumentsLength === 1){
            return element;
        }

        if(!isType(settings,obj) || crel[isNodeString](settings) || isArray(settings)) {
            --childIndex;
            settings = null;
        }

        // shortcut if there is only one child that is a string
        if((argumentsLength - childIndex) === 1 && isType(args[childIndex], 'string') && element[textContent] !== undefined){
            element[textContent] = args[childIndex];
        }else{
            for(; childIndex < argumentsLength; ++childIndex){
                child = args[childIndex];

                if(child == null){
                    continue;
                }

                if (isArray(child)) {
                  for (var i=0; i < child.length; ++i) {
                    appendChild(element, child[i]);
                  }
                } else {
                  appendChild(element, child);
                }
            }
        }

        for(var key in settings){
            if(!attributeMap[key]){
                element[setAttribute](key, settings[key]);
            }else{
                var attr = attributeMap[key];
                if(typeof attr === fn){
                    attr(element, settings[key]);
                }else{
                    element[setAttribute](attr, settings[key]);
                }
            }
        }

        return element;
    }

    // Used for mapping one kind of attribute to the supported version of that in bad browsers.
    crel[attrMapString] = {};

    crel[isElementString] = isElement;

    crel[isNodeString] = isNode;

    if(typeof Proxy !== 'undefined'){
        return new Proxy(crel, {
            get: function(target, key){
                !(key in crel) && (crel[key] = crel.bind(null, key));
                return crel[key];
            }
        });
    }

    return crel;
}));

},{}],5:[function(require,module,exports){
var doc = {
    document: typeof document !== 'undefined' ? document : null,
    setDocument: function(d){
        this.document = d;
    }
};

var arrayProto = [],
    isList = require('./isList'),
    getTargets = require('./getTargets')(doc.document),
    getTarget = require('./getTarget')(doc.document),
    space = ' ';


///[README.md]

function isIn(array, item){
    for(var i = 0; i < array.length; i++) {
        if(item === array[i]){
            return true;
        }
    }
}

/**

    ## .find

    finds elements that match the query within the scope of target

        //fluent
        doc(target).find(query);

        //legacy
        doc.find(target, query);
*/

function find(target, query){
    target = getTargets(target);
    if(query == null){
        return target;
    }

    if(isList(target)){
        var results = [];
        for (var i = 0; i < target.length; i++) {
            var subResults = doc.find(target[i], query);
            for(var j = 0; j < subResults.length; j++) {
                if(!isIn(results, subResults[j])){
                    results.push(subResults[j]);
                }
            }
        }
        return results;
    }

    return target ? target.querySelectorAll(query) : [];
}

/**

    ## .findOne

    finds the first element that matches the query within the scope of target

        //fluent
        doc(target).findOne(query);

        //legacy
        doc.findOne(target, query);
*/

function findOne(target, query){
    target = getTarget(target);
    if(query == null){
        return target;
    }

    if(isList(target)){
        var result;
        for (var i = 0; i < target.length; i++) {
            result = findOne(target[i], query);
            if(result){
                break;
            }
        }
        return result;
    }

    return target ? target.querySelector(query) : null;
}

/**

    ## .closest

    recurses up the DOM from the target node, checking if the current element matches the query

        //fluent
        doc(target).closest(query);

        //legacy
        doc.closest(target, query);
*/

function closest(target, query){
    target = getTarget(target);

    if(isList(target)){
        target = target[0];
    }

    while(
        target &&
        target.ownerDocument &&
        !is(target, query)
    ){
        target = target.parentNode;
    }

    return target === doc.document && target !== query ? null : target;
}

/**

    ## .is

    returns true if the target element matches the query

        //fluent
        doc(target).is(query);

        //legacy
        doc.is(target, query);
*/

function is(target, query){
    target = getTarget(target);

    if(isList(target)){
        target = target[0];
    }

    if(!target.ownerDocument || typeof query !== 'string'){
        return target === query;
    }

    if(target === query){
        return true;
    }

    var parentless = !target.parentNode;

    if(parentless){
        // Give the element a parent so that .querySelectorAll can be used
        document.createDocumentFragment().appendChild(target);
    }

    var result = arrayProto.indexOf.call(find(target.parentNode, query), target) >= 0;

    if(parentless){
        target.parentNode.removeChild(target);
    }

    return result;
}

/**

    ## .addClass

    adds classes to the target (space separated string or array)

        //fluent
        doc(target).addClass(query);

        //legacy
        doc.addClass(target, query);
*/

function addClass(target, classes){
    target = getTargets(target);

    if(isList(target)){
        for (var i = 0; i < target.length; i++) {
            addClass(target[i], classes);
        }
        return this;
    }
    if(!classes){
        return this;
    }

    var classes = Array.isArray(classes) ? classes : classes.split(space),
        currentClasses = target.classList ? null : target.className.split(space);

    for(var i = 0; i < classes.length; i++){
        var classToAdd = classes[i];
        if(!classToAdd || classToAdd === space){
            continue;
        }
        if(target.classList){
            target.classList.add(classToAdd);
        } else if(!currentClasses.indexOf(classToAdd)>=0){
            currentClasses.push(classToAdd);
        }
    }
    if(!target.classList){
        target.className = currentClasses.join(space);
    }
    return this;
}

/**

    ## .removeClass

    removes classes from the target (space separated string or array)

        //fluent
        doc(target).removeClass(query);

        //legacy
        doc.removeClass(target, query);
*/

function removeClass(target, classes){
    target = getTargets(target);

    if(isList(target)){
        for (var i = 0; i < target.length; i++) {
            removeClass(target[i], classes);
        }
        return this;
    }

    if(!classes){
        return this;
    }

    var classes = Array.isArray(classes) ? classes : classes.split(space),
        currentClasses = target.classList ? null : target.className.split(space);

    for(var i = 0; i < classes.length; i++){
        var classToRemove = classes[i];
        if(!classToRemove || classToRemove === space){
            continue;
        }
        if(target.classList){
            target.classList.remove(classToRemove);
            continue;
        }
        var removeIndex = currentClasses.indexOf(classToRemove);
        if(removeIndex >= 0){
            currentClasses.splice(removeIndex, 1);
        }
    }
    if(!target.classList){
        target.className = currentClasses.join(space);
    }
    return this;
}

function addEvent(settings){
    var target = getTarget(settings.target);
    if(target){
        target.addEventListener(settings.event, settings.callback, false);
    }else{
        console.warn('No elements matched the selector, so no events were bound.');
    }
}

/**

    ## .on

    binds a callback to a target when a DOM event is raised.

        //fluent
        doc(target/proxy).on(events, target[optional], callback);

    note: if a target is passed to the .on function, doc's target will be used as the proxy.

        //legacy
        doc.on(events, target, query, proxy[optional]);
*/

function on(events, target, callback, proxy){

    proxy = getTargets(proxy);

    if(!proxy){
        target = getTargets(target);
        // handles multiple targets
        if(isList(target)){
            var multiRemoveCallbacks = [];
            for (var i = 0; i < target.length; i++) {
                multiRemoveCallbacks.push(on(events, target[i], callback, proxy));
            }
            return function(){
                while(multiRemoveCallbacks.length){
                    multiRemoveCallbacks.pop();
                }
            };
        }
    }

    // handles multiple proxies
    // Already handles multiple proxies and targets,
    // because the target loop calls this loop.
    if(isList(proxy)){
        var multiRemoveCallbacks = [];
        for (var i = 0; i < proxy.length; i++) {
            multiRemoveCallbacks.push(on(events, target, callback, proxy[i]));
        }
        return function(){
            while(multiRemoveCallbacks.length){
                multiRemoveCallbacks.pop();
            }
        };
    }

    var removeCallbacks = [];

    if(typeof events === 'string'){
        events = events.split(space);
    }

    for(var i = 0; i < events.length; i++){
        var eventSettings = {};
        if(proxy){
            if(proxy === true){
                proxy = doc.document;
            }
            eventSettings.target = proxy;
            eventSettings.callback = function(event){
                var closestTarget = closest(event.target, target);
                if(closestTarget){
                    callback(event, closestTarget);
                }
            };
        }else{
            eventSettings.target = target;
            eventSettings.callback = callback;
        }

        eventSettings.event = events[i];

        addEvent(eventSettings);

        removeCallbacks.push(eventSettings);
    }

    return function(){
        while(removeCallbacks.length){
            var removeCallback = removeCallbacks.pop();
            getTarget(removeCallback.target).removeEventListener(removeCallback.event, removeCallback.callback);
        }
    }
}

/**

    ## .off

    removes events assigned to a target.

        //fluent
        doc(target/proxy).off(events, target[optional], callback);

    note: if a target is passed to the .on function, doc's target will be used as the proxy.

        //legacy
        doc.off(events, target, callback, proxy);
*/

function off(events, target, callback, proxy){
    if(isList(target)){
        for (var i = 0; i < target.length; i++) {
            off(events, target[i], callback, proxy);
        }
        return this;
    }
    if(proxy instanceof Array){
        for (var i = 0; i < proxy.length; i++) {
            off(events, target, callback, proxy[i]);
        }
        return this;
    }

    if(typeof events === 'string'){
        events = events.split(space);
    }

    if(typeof callback !== 'function'){
        proxy = callback;
        callback = null;
    }

    proxy = proxy ? getTarget(proxy) : doc.document;

    var targets = typeof target === 'string' ? find(target, proxy) : [target];

    for(var targetIndex = 0; targetIndex < targets.length; targetIndex++){
        var currentTarget = targets[targetIndex];

        for(var i = 0; i < events.length; i++){
            currentTarget.removeEventListener(events[i], callback);
        }
    }
    return this;
}

/**

    ## .append

    adds elements to a target

        //fluent
        doc(target).append(children);

        //legacy
        doc.append(target, children);
*/

function append(target, children){
    var target = getTarget(target),
        children = getTarget(children);

    if(isList(target)){
        target = target[0];
    }

    if(isList(children)){
        for (var i = 0; i < children.length; i++) {
            append(target, children[i]);
        }
        return;
    }

    target.appendChild(children);
}

/**

    ## .prepend

    adds elements to the front of a target

        //fluent
        doc(target).prepend(children);

        //legacy
        doc.prepend(target, children);
*/

function prepend(target, children){
    var target = getTarget(target),
        children = getTarget(children);

    if(isList(target)){
        target = target[0];
    }

    if(isList(children)){
        //reversed because otherwise the would get put in in the wrong order.
        for (var i = children.length -1; i; i--) {
            prepend(target, children[i]);
        }
        return;
    }

    target.insertBefore(children, target.firstChild);
}

/**

    ## .isVisible

    checks if an element or any of its parents display properties are set to 'none'

        //fluent
        doc(target).isVisible();

        //legacy
        doc.isVisible(target);
*/

function isVisible(target){
    var target = getTarget(target);
    if(!target){
        return;
    }
    if(isList(target)){
        var i = -1;

        while (target[i++] && isVisible(target[i])) {}
        return target.length >= i;
    }
    while(target.parentNode && target.style.display !== 'none'){
        target = target.parentNode;
    }

    return target === doc.document;
}

/**

    ## .indexOfElement

    returns the index of the element within it's parent element.

        //fluent
        doc(target).indexOfElement();

        //legacy
        doc.indexOfElement(target);

*/

function indexOfElement(target) {
    target = getTargets(target);
    if(!target){
        return;
    }

    if(isList(target)){
        target = target[0];
    }

    var i = -1;

    var parent = target.parentElement;

    if(!parent){
        return i;
    }

    while(parent.children[++i] !== target){}

    return i;
}


/**

    ## .ready

    call a callback when the document is ready.

    returns -1 if there is no parentElement on the target.

        //fluent
        doc().ready(callback);

        //legacy
        doc.ready(callback);
*/

function ready(callback){
    if(doc.document && (doc.document.readyState === 'complete' || doc.document.readyState === 'interactive')){
        callback();
    }else if(window.attachEvent){
        document.attachEvent("onreadystatechange", callback);
        window.attachEvent("onLoad",callback);
    }else if(document.addEventListener){
        document.addEventListener("DOMContentLoaded",callback,false);
    }
}

doc.find = find;
doc.findOne = findOne;
doc.closest = closest;
doc.is = is;
doc.addClass = addClass;
doc.removeClass = removeClass;
doc.off = off;
doc.on = on;
doc.append = append;
doc.prepend = prepend;
doc.isVisible = isVisible;
doc.ready = ready;
doc.indexOfElement = indexOfElement;

module.exports = doc;
},{"./getTarget":7,"./getTargets":8,"./isList":9}],6:[function(require,module,exports){
var doc = require('./doc'),
    isList = require('./isList'),
    getTargets = require('./getTargets')(doc.document),
    flocProto = [];

function Floc(items){
    this.push.apply(this, items);
}
Floc.prototype = flocProto;
flocProto.constructor = Floc;

function floc(target){
    var instance = getTargets(target);

    if(!isList(instance)){
        if(instance){
            instance = [instance];
        }else{
            instance = [];
        }
    }
    return new Floc(instance);
}

var returnsSelf = 'addClass removeClass append prepend'.split(' ');

for(var key in doc){
    if(typeof doc[key] === 'function'){
        floc[key] = doc[key];
        flocProto[key] = (function(key){
            var instance = this;
            // This is also extremely dodgy and fast
            return function(a,b,c,d,e,f){
                var result = doc[key](this, a,b,c,d,e,f);

                if(result !== doc && isList(result)){
                    return floc(result);
                }
                if(returnsSelf.indexOf(key) >=0){
                    return instance;
                }
                return result;
            };
        }(key));
    }
}
flocProto.on = function(events, target, callback){
    var proxy = this;
    if(typeof target === 'function'){
        callback = target;
        target = this;
        proxy = null;
    }
    doc.on(events, target, callback, proxy);
    return this;
};

flocProto.off = function(events, target, callback){
    var reference = this;
    if(typeof target === 'function'){
        callback = target;
        target = this;
        reference = null;
    }
    doc.off(events, target, callback, reference);
    return this;
};

flocProto.ready = function(callback){
    doc.ready(callback);
    return this;
};

flocProto.addClass = function(className){
    doc.addClass(this, className);
    return this;
};

flocProto.removeClass = function(className){
    doc.removeClass(this, className);
    return this;
};

module.exports = floc;
},{"./doc":5,"./getTargets":8,"./isList":9}],7:[function(require,module,exports){
var singleId = /^#\w+$/;

module.exports = function(document){
    return function getTarget(target){
        if(typeof target === 'string'){
            if(singleId.exec(target)){
                return document.getElementById(target.slice(1));
            }
            return document.querySelector(target);
        }

        return target;
    };
};
},{}],8:[function(require,module,exports){

var singleClass = /^\.\w+$/,
    singleId = /^#\w+$/,
    singleTag = /^\w+$/;

module.exports = function(document){
    return function getTargets(target){
        if(typeof target === 'string'){
            if(singleId.exec(target)){
                // If you have more than 1 of the same id in your page,
                // thats your own stupid fault.
                return [document.getElementById(target.slice(1))];
            }
            if(singleTag.exec(target)){
                return document.getElementsByTagName(target);
            }
            if(singleClass.exec(target)){
                return document.getElementsByClassName(target.slice(1));
            }
            return document.querySelectorAll(target);
        }

        return target;
    };
};
},{}],9:[function(require,module,exports){
module.exports = function isList(object){
    return object != null && typeof object === 'object' && 'length' in object && !('nodeType' in object) && object.self != object; // in IE8, window.self is window, but it is not === window, but it is == window......... WTF!?
}
},{}],10:[function(require,module,exports){
var is = require('./is'),
    GENERIC = '_generic',
    EventEmitter = require('events').EventEmitter,
    slice = Array.prototype.slice;

function flatten(item){
    return Array.isArray(item) ? item.reduce(function(result, element){
        if(element == null){
            return result;
        }
        return result.concat(flatten(element));
    },[]) : item;
}

function attachProperties(object, firm){
    for(var key in this._properties){
        this._properties[key].attach(object, firm);
    }
}

function onRender(){

    // Ensure all bindings are somewhat attached just before rendering
    this.attach(undefined, 0);

    for(var key in this._properties){
        this._properties[key].update();
    }
}

function detachProperties(firm){
    for(var key in this._properties){
        this._properties[key].detach(firm);
    }
}

function destroyProperties(){
    for(var key in this._properties){
        this._properties[key].destroy();
    }
}

function clone(){
    return this.fastn(this.component._type, this.component._settings, this.component._children.filter(function(child){
            return !child._templated;
        }).map(function(child){
            return child.clone();
        })
    );
}

function getSetBinding(newBinding){
    if(!arguments.length){
        return this.binding;
    }

    if(!is.binding(newBinding)){
        newBinding = this.fastn.binding(newBinding);
    }

    if(this.binding && this.binding !== newBinding){
        this.binding.removeListener('change', this.emitAttach);
        newBinding.attach(this.binding._model, this.binding._firm);
    }

    this.binding = newBinding;

    this.binding.on('change', this.emitAttach);
    this.binding.on('detach', this.emitDetach);

    this.emitAttach();

    return this.component;
};

function emitAttach(){
    var newBound = this.binding();
    if(newBound !== this.lastBound){
        this.lastBound = newBound;
        this.scope.attach(this.lastBound);
        this.component.emit('attach', this.scope, 1);
    }
}

function emitDetach(){
    this.component.emit('detach', 1);
}

function getScope(){
    return this.scope;
}

function destroy(){
    if(this.destroyed){
        return;
    }
    this.destroyed = true;

    this.component
        .removeAllListeners('render')
        .removeAllListeners('attach');

    this.component.emit('destroy');
    this.component.element = null;
    this.scope.destroy();
    this.binding.destroy();

    return this.component;
}

function attachComponent(object, firm){
    this.binding.attach(object, firm);
    return this.component;
}

function detachComponent(firm){
    this.binding.detach(firm);
    return this.component;
}

function isDestroyed(){
    return this.destroyed;
}

function setProperty(key, property){

    // Add a default property or use the one already there
    if(!property){
        property = this.component[key] || this.fastn.property();
    }

    this.component[key] = property;
    this.component._properties[key] = property;

    return this.component;
}

function extendComponent(type, settings, children){

    if(type in this.types){
        return this.component;
    }

    if(!(type in this.fastn.components)){

        if(!(GENERIC in this.fastn.components)){
            throw new Error('No component of type "' + type + '" is loaded');
        }

        this.fastn.components._generic(this.fastn, this.component, type, settings, children);

        this.types._generic = true;
    }else{

        this.fastn.components[type](this.fastn, this.component, type, settings, children);
    }

    this.types[type] = true;

    return this.component;
};

function isType(type){
    return type in this.types;
}

function FastnComponent(fastn, type, settings, children){
    var component = this;

    var componentScope = {
        types: {},
        fastn: fastn,
        component: component,
        binding: fastn.binding('.'),
        destroyed: false,
        scope: new fastn.Model(false),
        lastBound: null
    };

    componentScope.emitAttach = emitAttach.bind(componentScope);
    componentScope.emitDetach = emitDetach.bind(componentScope);
    componentScope.binding._default_binding = true;

    component._type = type;
    component._properties = {};
    component._settings = settings || {};
    component._children = children ? flatten(children) : [];

    component.attach = attachComponent.bind(componentScope);
    component.detach = detachComponent.bind(componentScope);
    component.scope = getScope.bind(componentScope);
    component.destroy = destroy.bind(componentScope);
    component.destroyed = isDestroyed.bind(componentScope);
    component.binding = getSetBinding.bind(componentScope);
    component.setProperty = setProperty.bind(componentScope);
    component.clone = clone.bind(componentScope);
    component.children = slice.bind(component._children);
    component.extend = extendComponent.bind(componentScope);
    component.is = isType.bind(componentScope);

    component.binding(componentScope.binding);

    component.on('attach', attachProperties.bind(this));
    component.on('render', onRender.bind(this));
    component.on('detach', detachProperties.bind(this));
    component.on('destroy', destroyProperties.bind(this));

    if(fastn.debug){
        component.on('render', function(){
            if(component.element && typeof component.element === 'object'){
                component.element._component = component;
            }
        });
    }
}
FastnComponent.prototype = Object.create(EventEmitter.prototype);
FastnComponent.prototype.constructor = FastnComponent;
FastnComponent.prototype._fastn_component = true;

module.exports = FastnComponent;
},{"./is":18,"events":72}],11:[function(require,module,exports){
var Enti = require('enti'),
    is = require('./is'),
    firmer = require('./firmer'),
    functionEmitter = require('./functionEmitter'),
    setPrototypeOf = require('setprototypeof'),
    same = require('same-value');

function fuseBinding(){
    var args = Array.prototype.slice.call(arguments);

    var bindings = args.slice(),
        transform = bindings.pop(),
        updateTransform,
        resultBinding = createBinding('result'),
        selfChanging;

    resultBinding._arguments = args;

    if(typeof bindings[bindings.length-1] === 'function' && !is.binding(bindings[bindings.length-1])){
        updateTransform = transform;
        transform = bindings.pop();
    }

    resultBinding._model.removeAllListeners();
    resultBinding._set = function(value){
        if(updateTransform){
            selfChanging = true;
            var newValue = updateTransform(value);
            if(!same(newValue, bindings[0]())){
                bindings[0](newValue);
                resultBinding._change(newValue);
            }
            selfChanging = false;
        }else{
            resultBinding._change(value);
        }
    };

    function change(){
        if(selfChanging){
            return;
        }
        resultBinding(transform.apply(null, bindings.map(function(binding){
            return binding();
        })));
    }

    bindings.forEach(function(binding, index){
        if(!is.binding(binding)){
            binding = createBinding(binding);
            bindings.splice(index,1,binding);
        }
        binding.on('change', change);
        resultBinding.on('detach', binding.detach);
    });

    var lastAttached;
    resultBinding.on('attach', function(object){
        selfChanging = true;
        bindings.forEach(function(binding){
            binding.attach(object, 1);
        });
        selfChanging = false;
        if(lastAttached !== object){
            change();
        }
        lastAttached = object;
    });

    return resultBinding;
}

function createValueBinding(){
    var valueBinding = createBinding('value');
    valueBinding.attach = function(){return valueBinding;};
    valueBinding.detach = function(){return valueBinding;};
    return valueBinding;
}

function bindingTemplate(newValue){
    if(!arguments.length){
        return this.value;
    }

    if(this.binding._fastn_binding === '.'){
        return;
    }

    this.binding._set(newValue);
    return this.binding;
}

function createBinding(path, more){

    if(more){ // used instead of arguments.length for performance
        return fuseBinding.apply(null, arguments);
    }

    if(path == null){
        return createValueBinding();
    }

    var bindingScope = {},
        binding = bindingScope.binding = bindingTemplate.bind(bindingScope),
        destroyed;

    setPrototypeOf(binding, functionEmitter);
    binding.setMaxListeners(10000);
    binding._arguments = [path];
    binding._model = new Enti(false);
    binding._fastn_binding = path;
    binding._firm = -Infinity;

    function modelAttachHandler(data){
        binding._model.attach(data);
        binding._change(binding._model.get(path));
        binding.emit('attach', data, 1);
    }

    function modelDetachHandler(){
        binding._model.detach();
    }

    binding.attach = function(object, firm){

        // If the binding is being asked to attach loosly to an object,
        // but it has already been defined as being firmly attached, do not attach.
        if(firmer(binding, firm)){
            return binding;
        }

        binding._firm = firm;

        var isEnti = Enti.isEnti(object);

        if(isEnti && bindingScope.attachedModel === object){
            return binding;
        }

        if(bindingScope.attachedModel){
            bindingScope.attachedModel.removeListener('attach', modelAttachHandler);
            bindingScope.attachedModel.removeListener('detach', modelDetachHandler);
            bindingScope.attachedModel = null;
        }

        if(isEnti){
            bindingScope.attachedModel = object;
            bindingScope.attachedModel.on('attach', modelAttachHandler);
            bindingScope.attachedModel.on('detach', modelDetachHandler);
            object = object._model;
        }

        if(!(object instanceof Object)){
            object = {};
        }

        if(binding._model._model === object){
            return binding;
        }

        modelAttachHandler(object);

        return binding;
    };

    binding.detach = function(firm){
        if(firmer(binding, firm)){
            return binding;
        }

        bindingScope.value = undefined;
        if(binding._model.isAttached()){
            binding._model.detach();
        }
        binding.emit('detach', 1);
        return binding;
    };
    binding._set = function(newValue){
        if(same(binding._model.get(path), newValue)){
            return;
        }
        if(!binding._model.isAttached()){
            binding._model.attach(binding._model.get('.'));
        }
        binding._model.set(path, newValue);
    };
    binding._change = function(newValue){
        bindingScope.value = newValue;
        binding.emit('change', binding());
    };
    binding.clone = function(keepAttachment){
        var newBinding = createBinding.apply(null, binding._arguments);

        if(keepAttachment){
            newBinding.attach(bindingScope.attachedModel || binding._model._model, binding._firm);
        }

        return newBinding;
    };
    binding.destroy = function(soft){
        if(destroyed){
            return;
        }
        if(soft && binding.listeners('change').length){
            return;
        }
        destroyed = true;
        binding.emit('destroy');
        binding.detach();
        binding._model.destroy();
    };

    binding.destroyed = function(){
        return destroyed;
    };

    if(path !== '.'){
        binding._model.on(path, binding._change);
    }

    return binding;
}

function from(valueOrBinding){
    if(is.binding(valueOrBinding)){
        return valueOrBinding;
    }

    return createBinding()(valueOrBinding);
}

createBinding.from = from;

module.exports = createBinding;
},{"./firmer":14,"./functionEmitter":15,"./is":18,"enti":20,"same-value":22,"setprototypeof":25}],12:[function(require,module,exports){
function insertChild(fastn, container, child, index){
    var currentIndex = container._children.indexOf(child),
        newComponent = fastn.toComponent(child);

    if(newComponent !== child && ~currentIndex){
        container._children.splice(currentIndex, 1, newComponent);
    }

    if(!~currentIndex || newComponent !== child){
        newComponent.attach(container.scope(), 1);
    }

    if(currentIndex !== index){
        if(~currentIndex){
            container._children.splice(currentIndex, 1);
        }
        container._children.splice(index, 0, newComponent);
    }

    if(container.element){
        if(!newComponent.element){
            newComponent.render();
        }
        container._insert(newComponent.element, index);
        newComponent.emit('insert', container);
        container.emit('childInsert', newComponent);
    }
}

function getContainerElement(){
    return this.containerElement || this.element;
}

function insert(child, index){
    var childComponent = child,
        container = this.container,
        fastn = this.fastn;

    if(index && typeof index === 'object'){
        childComponent = Array.prototype.slice.call(arguments);
    }

    if(isNaN(index)){
        index = container._children.length;
    }

    if(Array.isArray(childComponent)){
        for (var i = 0; i < childComponent.length; i++) {
            container.insert(childComponent[i], i + index);
        }
    }else{
        insertChild(fastn, container, childComponent, index);
    }

    return container;
}

module.exports = function(fastn, component, type, settings, children){
    component.insert = insert.bind({
        container: component,
        fastn: fastn
    });

    component._insert = function(element, index){
        var containerElement = component.getContainerElement();
        if(!containerElement){
            return;
        }

        if(containerElement.childNodes[index] === element){
            return;
        }

        containerElement.insertBefore(element, containerElement.childNodes[index]);
    };

    component.remove = function(childComponent){
        var index = component._children.indexOf(childComponent);
        if(~index){
            component._children.splice(index,1);
        }

        childComponent.detach(1);

        if(childComponent.element){
            component._remove(childComponent.element);
            childComponent.emit('remove', component);
        }
        component.emit('childRemove', childComponent);
    };

    component._remove = function(element){
        var containerElement = component.getContainerElement();

        if(!element || !containerElement || element.parentNode !== containerElement){
            return;
        }

        containerElement.removeChild(element);
    };

    component.empty = function(){
        while(component._children.length){
            component.remove(component._children.pop());
        }
    };

    component.replaceChild = function(oldChild, newChild){
        var index = component._children.indexOf(oldChild);

        if(!~index){
            return;
        }

        component.remove(oldChild);
        component.insert(newChild, index);
    };

    component.getContainerElement = getContainerElement.bind(component);

    component.on('render', component.insert.bind(null, component._children, 0));

    component.on('attach', function(model, firm){
        for(var i = 0; i < component._children.length; i++){
            if(fastn.isComponent(component._children[i])){
                component._children[i].attach(model, firm);
            }
        }
    });

    component.on('destroy', function(data, firm){
        for(var i = 0; i < component._children.length; i++){
            if(fastn.isComponent(component._children[i])){
                component._children[i].destroy(firm);
            }
        }
    });

    return component;
};
},{}],13:[function(require,module,exports){
var setify = require('setify'),
    classist = require('classist');

function updateTextProperty(generic, element, value){
    if(arguments.length === 2){
        return element.textContent;
    }
    element.textContent = (value == null ? '' : value);
}

module.exports = {
    class: function(generic, element, value){
        if(!generic._classist){
            generic._classist = classist(element);
        }

        if(arguments.length < 3){
            return generic._classist();
        }

        generic._classist(value);
    },
    display: function(generic, element, value){
        if(arguments.length === 2){
            return element.style.display !== 'none';
        }
        element.style.display = value ? null : 'none';
    },
    disabled: function(generic, element, value){
        if(arguments.length === 2){
            return element.hasAttribute('disabled');
        }
        if(value){
            element.setAttribute('disabled', 'disabled');
        }else{
            element.removeAttribute('disabled');
        }
    },
    textContent: updateTextProperty,
    innerText: updateTextProperty,
    innerHTML: updateTextProperty,
    value: function(generic, element, value){
        var inputType = element.type;

        if(element.nodeName === 'INPUT' && inputType === 'date'){
            if(arguments.length === 2){
                return element.value ? new Date(element.value.replace(/-/g,'/').replace('T',' ')) : null;
            }

            value = value != null ? new Date(value) : null;

            if(!value || isNaN(value)){
                element.value = null;
            }else{
                element.value = [
                    value.getFullYear(),
                    ('0' + (value.getMonth() + 1)).slice(-2),
                    ('0' + value.getDate()).slice(-2)
                ].join('-');
            }
            return;
        }

        if(arguments.length === 2){
            return element.value;
        }
        if(value === undefined){
            value = null;
        }

        if(element.nodeName === 'PROGRESS'){
            value = parseFloat(value) || 0;
        }

        setify(element, value);
    },
    max: function(generic, element, value) {
        if(arguments.length === 2){
            return element.value;
        }

        if(element.nodeName === 'PROGRESS'){
            value = parseFloat(value) || 0;
        }

        element.max = value;
    },
    style: function(generic, element, value){
        if(arguments.length === 2){
            return element.style;
        }

        for(var key in value){
            element.style[key] = value[key];
        }
    }
};
},{"classist":19,"setify":23}],14:[function(require,module,exports){
// Is the entity firmer than the new firmness
module.exports = function(entity, firm){
    if(firm != null && (entity._firm === undefined || firm < entity._firm)){
        return true;
    }
};
},{}],15:[function(require,module,exports){
var EventEmitter = require('events').EventEmitter,
    functionEmitterPrototype = function(){};

for(var key in EventEmitter.prototype){
    functionEmitterPrototype[key] = EventEmitter.prototype[key];
}

module.exports = functionEmitterPrototype;
},{"events":72}],16:[function(require,module,exports){
var containerComponent = require('./containerComponent'),
    schedule = require('./schedule'),
    fancyProps = require('./fancyProps'),
    matchDomHandlerName = /^((?:el\.)?)([^. ]+)(?:\.(capture))?$/,
    GENERIC = '_generic';

function createProperties(fastn, component, settings){
    for(var key in settings){
        var setting = settings[key];

        if(typeof setting === 'function' && !fastn.isProperty(setting) && !fastn.isBinding(setting)){
            continue;
        }

        component.addDomProperty(key);
    }
}

function addDomHandler(component, element, handlerName, eventName, capture){
    var eventParts = handlerName.split('.');

    if(eventParts[0] === 'on'){
        eventParts.shift();
    }

    var handler = function(event){
            component.emit(handlerName, event, component.scope());
        };

    element.addEventListener(eventName, handler, capture);

    component.on('destroy', function(){
        element.removeEventListener(eventName, handler, capture);
    });
}

function addDomHandlers(component, element, eventNames){
    var events = eventNames.split(' ');

    for(var i = 0; i < events.length; i++){
        var eventName = events[i],
            match = eventName.match(matchDomHandlerName);

        if(!match){
            continue;
        }

        if(match[1] || 'on' + match[2] in element){
            addDomHandler(component, element, eventNames, match[2], match[3]);
        }
    }
}

function addAutoHandler(component, element, key, settings){
    if(!settings[key]){
        return;
    }

    var autoEvent = settings[key].split(':'),
        eventName = key.slice(2);

    delete settings[key];

    var handler = function(event){
        var fancyProp = fancyProps[autoEvent[1]],
            value = fancyProp ? fancyProp(component, element) : element[autoEvent[1]];

        component[autoEvent[0]](value);
    };

    element.addEventListener(eventName, handler);

    component.on('destroy', function(){
        element.removeEventListener(eventName, handler);
    });
}

function addDomProperty(fastn, key, property){
    var component = this;

    property = property || component[key] || fastn.property();
    component.setProperty(key, property);

    function update(){
        var element = component.getPropertyElement(key),
            value = property();

        if(!element || component.destroyed()){
            return;
        }

        var isProperty = key in element,
            fancyProp = fancyProps[key],
            previous = fancyProp ? fancyProp(component, element) : isProperty ? element[key] : element.getAttribute(key);

        if(!fancyProp && !isProperty && value == null){
            value = '';
        }

        if(value !== previous){
            if(fancyProp){
                fancyProp(component, element, value);
                return;
            }

            if(isProperty){
                element[key] = value;
                return;
            }

            if(typeof value !== 'function' && typeof value !== 'object'){
                element.setAttribute(key, value);
            }
        }
    }

    property.updater(update);
}

function onRender(){
    var component = this,
        element;

    for(var key in component._settings){
        element = component.getEventElement(key);
        if(key.slice(0,2) === 'on' && key in element){
            addAutoHandler(component, element, key, component._settings);
        }
    }

    for(var eventKey in component._events){
        element = component.getEventElement(key);
        addDomHandlers(component, element, eventKey);
    }
}

function render(){
    this.element = this.createElement(this._settings.tagName || this._tagName);

    this.emit('render');

    return this;
};

function genericComponent(fastn, component, type, settings, children){
    if(component.is(type)){
        return component;
    }

    if(type === GENERIC){
        component._tagName = component._tagName || 'div';
    }else{
        component._tagName = type;
    }

    if(component.is(GENERIC)){
        return component;
    }

    component.extend('_container', settings, children);

    component.addDomProperty = addDomProperty.bind(component, fastn);
    component.getEventElement = component.getContainerElement;
    component.getPropertyElement = component.getContainerElement;
    component.updateProperty = genericComponent.updateProperty;
    component.createElement = genericComponent.createElement;

    createProperties(fastn, component, settings);

    component.render = render.bind(component);

    component.on('render', onRender);

    return component;
}

genericComponent.updateProperty = function(component, property, update){
    if(typeof document !== 'undefined' && document.contains(component.element)){
        schedule(property, update);
    }else{
        update();
    }
};

genericComponent.createElement = function(tagName){
    if(tagName instanceof Node){
        return tagName;
    }
    return document.createElement(tagName);
};

module.exports = genericComponent;
},{"./containerComponent":12,"./fancyProps":13,"./schedule":32}],17:[function(require,module,exports){
var createProperty = require('./property'),
    createBinding = require('./binding'),
    BaseComponent = require('./baseComponent'),
    crel = require('crel'),
    Enti = require('enti'),
    objectAssign = require('object-assign'),
    is = require('./is');

function inflateProperties(component, settings){
    for(var key in settings){
        var setting = settings[key],
            property = component[key];

        if(is.property(settings[key])){

            if(is.property(property)){
                property.destroy();
            }

            setting.addTo(component, key);

        }else if(is.property(property)){

            if(is.binding(setting)){
                property.binding(setting);
            }else{
                property(setting);
            }

            property.addTo(component, key);
        }
    }
}

function validateExpectedComponents(components, componentName, expectedComponents){
    expectedComponents = expectedComponents.filter(function(componentName){
        return !(componentName in components);
    });

    if(expectedComponents.length){
        console.warn([
            'fastn("' + componentName + '") uses some components that have not been registered with fastn',
            'Expected conponent constructors: ' + expectedComponents.join(', ')
        ].join('\n\n'));
    }
}

module.exports = function(components, debug){

    if(!components || typeof components !== 'object'){
        throw new Error('fastn must be initialised with a components object');
    }

    components._container = components._container || require('./containerComponent');

    function fastn(type){

        var args = [];
        for(var i = 0; i < arguments.length; i++){
            args[i] = arguments[i];
        }

        var settings = args[1],
            childrenIndex = 2,
            settingsChild = fastn.toComponent(args[1]);

        if(Array.isArray(args[1]) || settingsChild || !args[1]){
            args[1] = settingsChild || args[1];
            childrenIndex--;
            settings = null;
        }

        settings = objectAssign({}, settings || {});

        var types = typeof type === 'string' ? type.split(':') : Array.isArray(type) ? type : [type],
            baseType,
            children = args.slice(childrenIndex),
            component = fastn.base(type, settings, children);

        while(baseType = types.shift()){
            component.extend(baseType, settings, children);
        }

        component._properties = {};

        inflateProperties(component, settings);

        return component;
    }

    fastn.toComponent = function(component){
        if(component == null){
            return;
        }
        if(is.component(component)){
            return component;
        }
        if(typeof component !== 'object' || component instanceof Date){
            return fastn('text', {auto: true}, component);
        }
        if(crel.isElement(component)){
            return fastn(component);
        }
        if(crel.isNode(component)){
            return fastn('text', {auto: true}, component.textContent);
        }
    };

    fastn.debug = debug;
    fastn.property = createProperty;
    fastn.binding = createBinding;
    fastn.isComponent = is.component;
    fastn.isBinding = is.binding;
    fastn.isDefaultBinding = is.defaultBinding;
    fastn.isBindingObject = is.bindingObject;
    fastn.isProperty = is.property;
    fastn.components = components;
    fastn.Model = Enti;

    fastn.base = function(type, settings, children){
        return new BaseComponent(fastn, type, settings, children);
    };

    for(var key in components){
        var componentConstructor = components[key];

        if(componentConstructor.expectedComponents){
            validateExpectedComponents(components, key, componentConstructor.expectedComponents);
        }
    }

    return fastn;
};
},{"./baseComponent":10,"./binding":11,"./containerComponent":12,"./is":18,"./property":31,"crel":4,"enti":20,"object-assign":21}],18:[function(require,module,exports){
var FUNCTION = 'function',
    OBJECT = 'object',
    FASTNBINDING = '_fastn_binding',
    FASTNPROPERTY = '_fastn_property',
    FASTNCOMPONENT = '_fastn_component',
    DEFAULTBINDING = '_default_binding';

function isComponent(thing){
    return thing && typeof thing === OBJECT && FASTNCOMPONENT in thing;
}

function isBindingObject(thing){
    return thing && typeof thing === OBJECT && FASTNBINDING in thing;
}

function isBinding(thing){
    return typeof thing === FUNCTION && FASTNBINDING in thing;
}

function isProperty(thing){
    return typeof thing === FUNCTION && FASTNPROPERTY in thing;
}

function isDefaultBinding(thing){
    return typeof thing === FUNCTION && FASTNBINDING in thing && DEFAULTBINDING in thing;
}

module.exports = {
    component: isComponent,
    bindingObject: isBindingObject,
    binding: isBinding,
    defaultBinding: isDefaultBinding,
    property: isProperty
};
},{}],19:[function(require,module,exports){
module.exports = function(element){
    var lastClasses = [];

    return function(classes){

        if(!arguments.length){
            return lastClasses.join(' ');
        }

        function cleanClassName(result, className){
            if(typeof className === 'string' && className.match(/\s/)){
                className = className.split(' ');
            }

            if(Array.isArray(className)){
                return result.concat(className.reduce(cleanClassName, []));
            }

            if(className != null && className !== '' && typeof className !== 'boolean'){
                result.push(String(className).trim());
            }

            return result;
        }

        var newClasses = cleanClassName([], classes),
            currentClasses = element.className ? element.className.split(' ') : [];

        lastClasses.map(function(className){
            if(!className){
                return;
            }

            var index = currentClasses.indexOf(className);

            if(~index){
                currentClasses.splice(index, 1);
            }
        });

        currentClasses = currentClasses.concat(newClasses);
        lastClasses = newClasses;

        element.className = currentClasses.join(' ');
    };
};

},{}],20:[function(require,module,exports){
(function (global){
var EventEmitter = require('events').EventEmitter;

function toArray(items){
    return Array.prototype.slice.call(items);
}

var deepRegex = /[|.]/i;

function matchDeep(path){
    return (path + '').match(deepRegex);
}

function isWildcardPath(path){
    var stringPath = (path + '');
    return ~stringPath.indexOf('*');
}

function getTargetKey(path){
    var stringPath = (path + '');
    return stringPath.split('|').shift();
}

var eventSystemVersion = 1,
    globalKey = '_entiEventState' + eventSystemVersion
    globalState = global[globalKey] = global[globalKey] || {
        instances: []
    };

var modifiedEnties = globalState.modifiedEnties = globalState.modifiedEnties || new Set(),
    trackedObjects = globalState.trackedObjects = globalState.trackedObjects || new WeakMap();

function leftAndRest(path){
    var stringPath = (path + '');

    // Special case when you want to filter on self (.)
    if(stringPath.slice(0,2) === '.|'){
        return ['.', stringPath.slice(2)];
    }

    var match = matchDeep(stringPath);
    if(match){
        return [stringPath.slice(0, match.index), stringPath.slice(match.index+1)];
    }
    return stringPath;
}

function isWildcardKey(key){
    return key.charAt(0) === '*';
}

function isFeralcardKey(key){
    return key === '**';
}

function addHandler(object, key, handler){
    var trackedKeys = trackedObjects.get(object);

    if(trackedKeys == null){
        trackedKeys = {};
        trackedObjects.set(object, trackedKeys);
    }

    var handlers = trackedKeys[key];

    if(!handlers){
        handlers = new Set();
        trackedKeys[key] = handlers;
    }

    handlers.add(handler);
}

function removeHandler(object, key, handler){
    var trackedKeys = trackedObjects.get(object);

    if(trackedKeys == null){
        return;
    }

    var handlers = trackedKeys[key];

    if(!handlers){
        return;
    }

    handlers.delete(handler);
}

function trackObjects(eventName, tracked, handler, object, key, path){
    if(!object || typeof object !== 'object'){
        return;
    }

    var eventKey = key === '**' ? '*' : key,
        target = object[key],
        targetIsObject = target && typeof target === 'object';

    if(targetIsObject && tracked.has(target)){
        return;
    }

    var handle = function(value, event, emitKey){
        if(eventKey !== '*' && typeof object[eventKey] === 'object' && object[eventKey] !== target){
            if(targetIsObject){
                tracked.delete(target);
            }
            removeHandler(object, eventKey, handle);
            trackObjects(eventName, tracked, handler, object, key, path);
            return;
        }

        if(eventKey === '*'){
            trackKeys(object, key, path);
        }

        if(!tracked.has(object)){
            return;
        }

        if(key !== '**' || !path){
            handler(value, event, emitKey);
        }
    }

    function trackKeys(target, root, rest){
        var keys = Object.keys(target);
        for(var i = 0; i < keys.length; i++){
            if(isFeralcardKey(root)){
                trackObjects(eventName, tracked, handler, target, keys[i], '**' + (rest ? '.' : '') + (rest || ''));
            }else{
                trackObjects(eventName, tracked, handler, target, keys[i], rest);
            }
        }
    }

    addHandler(object, eventKey, handle);

    if(!targetIsObject){
        return;
    }

    // This would obviously be better implemented with a WeakSet,
    // But I'm trying to keep filesize down, and I don't really want another
    // polyfill when WeakMap works well enough for the task.
    tracked.add(target);

    if(!path){
        return;
    }

    var rootAndRest = leftAndRest(path),
        root,
        rest;

    if(!Array.isArray(rootAndRest)){
        root = rootAndRest;
    }else{
        root = rootAndRest[0];
        rest = rootAndRest[1];

        // If the root is '.', watch for events on *
        if(root === '.'){
            root = '*';
        }
    }

    if(targetIsObject && isWildcardKey(root)){
        trackKeys(target, root, rest);
    }

    trackObjects(eventName, tracked, handler, target, root, rest);
}

var trackedEvents = new WeakMap();
function createHandler(enti, trackedObjectPaths, trackedPaths, eventName){
    var oldModel = enti._model;
    return function(event, emitKey){
        trackedPaths.entis.forEach(function(enti){
            if(enti._emittedEvents[eventName] === emitKey){
                return;
            }

            if(enti._model !== oldModel){
                trackedPaths.entis.delete(enti);
                if(trackedPaths.entis.size === 0){
                    delete trackedObjectPaths[eventName];
                    if(!Object.keys(trackedObjectPaths).length){
                        trackedEvents.delete(oldModel);
                    }
                }
                return;
            }

            enti._emittedEvents[eventName] = emitKey;

            var targetKey = getTargetKey(eventName),
                value = isWildcardPath(targetKey) ? undefined : enti.get(targetKey);

            enti.emit(eventName, value, event);
        });
    };
}

function trackPath(enti, eventName){
    var object = enti._model,
        trackedObjectPaths = trackedEvents.get(object);

    if(!trackedObjectPaths){
        trackedObjectPaths = {};
        trackedEvents.set(object, trackedObjectPaths);
    }

    var trackedPaths = trackedObjectPaths[eventName];

    if(!trackedPaths){
        trackedPaths = {
            entis: new Set(),
            trackedObjects: new WeakSet()
        };
        trackedObjectPaths[eventName] = trackedPaths;
    }else if(trackedPaths.entis.has(enti)){
        return;
    }

    trackedPaths.entis.add(enti);

    var handler = createHandler(enti, trackedObjectPaths, trackedPaths, eventName);

    trackObjects(eventName, trackedPaths.trackedObjects, handler, {model:object}, 'model', eventName);
}

function trackPaths(enti){
    if(!enti._events || !enti._model){
        return;
    }

    for(var key in enti._events){
        trackPath(enti, key);
    }
    modifiedEnties.delete(enti);
}

function emitEvent(object, key, value, emitKey){

    modifiedEnties.forEach(trackPaths);

    var trackedKeys = trackedObjects.get(object);

    if(!trackedKeys){
        return;
    }

    var event = {
        value: value,
        key: key,
        object: object
    };

    function emitForKey(handler){
        handler(event, emitKey);
    }

    if(trackedKeys[key]){
        trackedKeys[key].forEach(emitForKey);
    }

    if(trackedKeys['*']){
        trackedKeys['*'].forEach(emitForKey);
    }
}

function emit(events){
    var emitKey = {};
    events.forEach(function(event){
        emitEvent(event[0], event[1], event[2], emitKey);
    });
}

function Enti(model){
    var detached = model === false;

    if(!model || (typeof model !== 'object' && typeof model !== 'function')){
        model = {};
    }

    this._emittedEvents = {};
    if(detached){
        this._model = {};
    }else{
        this.attach(model);
    }

    this.on('newListener', function(){
        modifiedEnties.add(this);
    });
}
Enti.get = function(model, key){
    if(!model || typeof model !== 'object'){
        return;
    }

    key = getTargetKey(key);

    if(key === '.'){
        return model;
    }


    var path = leftAndRest(key);
    if(Array.isArray(path)){
        return Enti.get(model[path[0]], path[1]);
    }

    return model[key];
};
Enti.set = function(model, key, value){
    if(!model || typeof model !== 'object'){
        return;
    }

    key = getTargetKey(key);

    var path = leftAndRest(key);
    if(Array.isArray(path)){
        return Enti.set(model[path[0]], path[1], value);
    }

    var original = model[key];

    if(typeof value !== 'object' && value === original){
        return;
    }

    var keysChanged = !(key in model);

    model[key] = value;

    var events = [[model, key, value]];

    if(keysChanged){
        if(Array.isArray(model)){
            events.push([model, 'length', model.length]);
        }
    }

    emit(events);
};
Enti.push = function(model, key, value){
    if(!model || typeof model !== 'object'){
        return;
    }

    var target;
    if(arguments.length < 3){
        value = key;
        key = '.';
        target = model;
    }else{
        var path = leftAndRest(key);
        if(Array.isArray(path)){
            return Enti.push(model[path[0]], path[1], value);
        }

        target = model[key];
    }

    if(!Array.isArray(target)){
        throw 'The target is not an array.';
    }

    target.push(value);

    var events = [
        [target, target.length-1, value],
        [target, 'length', target.length]
    ];

    emit(events);
};
Enti.insert = function(model, key, value, index){
    if(!model || typeof model !== 'object'){
        return;
    }


    var target;
    if(arguments.length < 4){
        index = value;
        value = key;
        key = '.';
        target = model;
    }else{
        var path = leftAndRest(key);
        if(Array.isArray(path)){
            return Enti.insert(model[path[0]], path[1], value, index);
        }

        target = model[key];
    }

    if(!Array.isArray(target)){
        throw 'The target is not an array.';
    }

    target.splice(index, 0, value);

    var events = [
        [target, index, value],
        [target, 'length', target.length]
    ];

    emit(events);
};
Enti.remove = function(model, key, subKey){
    if(!model || typeof model !== 'object'){
        return;
    }

    var path = leftAndRest(key);
    if(Array.isArray(path)){
        return Enti.remove(model[path[0]], path[1], subKey);
    }

    // Remove a key off of an object at 'key'
    if(subKey != null){
        Enti.remove(model[key], subKey);
        return;
    }

    if(key === '.'){
        throw '. (self) is not a valid key to remove';
    }

    var events = [];

    if(Array.isArray(model)){
        model.splice(key, 1);
        events.push([model, 'length', model.length]);
    }else{
        delete model[key];
        events.push([model, key]);
    }

    emit(events);
};
Enti.move = function(model, key, index){
    if(!model || typeof model !== 'object'){
        return;
    }

    var path = leftAndRest(key);
    if(Array.isArray(path)){
        return Enti.move(model[path[0]], path[1], index);
    }

    if(key === index){
        return;
    }

    if(!Array.isArray(model)){
        throw 'The model is not an array.';
    }

    var item = model[key];

    model.splice(key, 1);

    model.splice(index - (index > key ? 0 : 1), 0, item);

    emit([[model, index, item]]);
};
Enti.update = function(model, key, value){
    if(!model || typeof model !== 'object'){
        return;
    }

    var target,
        isArray = Array.isArray(value);

    if(arguments.length < 3){
        value = key;
        key = '.';
        target = model;
    }else{
        var path = leftAndRest(key);
        if(Array.isArray(path)){
            return Enti.update(model[path[0]], path[1], value);
        }

        target = model[key];

        if(target == null){
            model[key] = isArray ? [] : {};
        }
    }

    if(typeof value !== 'object'){
        throw 'The value is not an object.';
    }

    if(typeof target !== 'object'){
        throw 'The target is not an object.';
    }

    var events = [],
        updatedObjects = new WeakSet();

    function updateTarget(target, value){
        for(var key in value){
            var currentValue = target[key];
            if(currentValue instanceof Object && !updatedObjects.has(currentValue)){
                updatedObjects.add(currentValue);
                updateTarget(currentValue, value[key]);
                continue;
            }
            target[key] = value[key];
            events.push([target, key, value[key]]);
        }

        if(Array.isArray(target)){
            events.push([target, 'length', target.length]);
        }
    }

    updateTarget(target, value);

    emit(events);
};
Enti.prototype = Object.create(EventEmitter.prototype);
Enti.prototype._maxListeners = 100;
Enti.prototype.constructor = Enti;
Enti.prototype.attach = function(model){
    if(this._model !== model){
        this.detach();
    }

    modifiedEnties.add(this);
    this._attached = true;
    this._model = model;
    this.emit('attach', model);
};
Enti.prototype.detach = function(){
    modifiedEnties.delete(this);

    this._emittedEvents = {};
    this._model = {};
    this._attached = false;
    this.emit('detach');
};
Enti.prototype.destroy = function(){
    this.detach();
    this._events = null;
    this.emit('destroy');
};
Enti.prototype.get = function(key){
    return Enti.get(this._model, key);
};

Enti.prototype.set = function(key, value){
    return Enti.set(this._model, key, value);
};

Enti.prototype.push = function(key, value){
    return Enti.push.apply(null, [this._model].concat(toArray(arguments)));
};

Enti.prototype.insert = function(key, value, index){
    return Enti.insert.apply(null, [this._model].concat(toArray(arguments)));
};

Enti.prototype.remove = function(key, subKey){
    return Enti.remove.apply(null, [this._model].concat(toArray(arguments)));
};

Enti.prototype.move = function(key, index){
    return Enti.move.apply(null, [this._model].concat(toArray(arguments)));
};

Enti.prototype.update = function(key, index){
    return Enti.update.apply(null, [this._model].concat(toArray(arguments)));
};
Enti.prototype.isAttached = function(){
    return this._attached;
};
Enti.prototype.attachedCount = function(){
    return modifiedEnties.size;
};

Enti.isEnti = function(target){
    return target && !!~globalState.instances.indexOf(target.constructor);
};

Enti.store = function(target, key, value){
    if(arguments.length < 2){
        return Enti.get(target, key);
    }

    Enti.set(target, key, value);
};

globalState.instances.push(Enti);

module.exports = Enti;

}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})

},{"events":72}],21:[function(require,module,exports){
'use strict';
var propIsEnumerable = Object.prototype.propertyIsEnumerable;

function ToObject(val) {
	if (val == null) {
		throw new TypeError('Object.assign cannot be called with null or undefined');
	}

	return Object(val);
}

function ownEnumerableKeys(obj) {
	var keys = Object.getOwnPropertyNames(obj);

	if (Object.getOwnPropertySymbols) {
		keys = keys.concat(Object.getOwnPropertySymbols(obj));
	}

	return keys.filter(function (key) {
		return propIsEnumerable.call(obj, key);
	});
}

module.exports = Object.assign || function (target, source) {
	var from;
	var keys;
	var to = ToObject(target);

	for (var s = 1; s < arguments.length; s++) {
		from = arguments[s];
		keys = ownEnumerableKeys(Object(from));

		for (var i = 0; i < keys.length; i++) {
			to[keys[i]] = from[keys[i]];
		}
	}

	return to;
};

},{}],22:[function(require,module,exports){
module.exports = function isSame(a, b){
    if(a === b){
        return true;
    }

    if(
        typeof a !== typeof b ||
        typeof a === 'object' &&
        !(a instanceof Date && b instanceof Date)
    ){
        return false;
    }

    return String(a) === String(b);
};
},{}],23:[function(require,module,exports){
var naturalSelection = require('natural-selection');

module.exports = function(element, value){
    var canSet = naturalSelection(element) && element === document.activeElement;

    if (canSet) {
        var start = element.selectionStart,
            end = element.selectionEnd;

        element.value = value;
        element.setSelectionRange(start, end);
    } else {
        element.value = value;
    }
};

},{"natural-selection":24}],24:[function(require,module,exports){
var supportedTypes = ['text', 'search', 'tel', 'url', 'password'];

module.exports = function(element){
    return !!(element.setSelectionRange && ~supportedTypes.indexOf(element.type));
};

},{}],25:[function(require,module,exports){
module.exports = Object.setPrototypeOf || {__proto__:[]} instanceof Array ? setProtoOf : mixinProperties;

function setProtoOf(obj, proto) {
	obj.__proto__ = proto;
}

function mixinProperties(obj, proto) {
	for (var prop in proto) {
		obj[prop] = proto[prop];
	}
}

},{}],26:[function(require,module,exports){
var clone = require('clone'),
    deepEqual = require('deep-equal');

function keysAreDifferent(keys1, keys2){
    if(keys1 === keys2){
        return;
    }
    if(!keys1 || !keys2 || keys1.length !== keys2.length){
        return true;
    }
    for(var i = 0; i < keys1.length; i++){
        if(!~keys2.indexOf(keys1[i])){
            return true;
        }
    }
}

function getKeys(value){
    if(!value || typeof value !== 'object'){
        return;
    }

    return Object.keys(value);
}

function WhatChanged(value, changesToTrack){
    this._changesToTrack = {};

    if(changesToTrack == null){
        changesToTrack = 'value type keys structure reference';
    }

    if(typeof changesToTrack !== 'string'){
        throw 'changesToTrack must be of type string';
    }

    changesToTrack = changesToTrack.split(' ');

    for (var i = 0; i < changesToTrack.length; i++) {
        this._changesToTrack[changesToTrack[i]] = true;
    };

    this.update(value);
}
WhatChanged.prototype.update = function(value){
    var result = {},
        changesToTrack = this._changesToTrack,
        newKeys = getKeys(value);

    if('value' in changesToTrack && value+'' !== this._lastReference+''){
        result.value = true;
    }
    if(
        'type' in changesToTrack && typeof value !== typeof this._lastValue ||
        (value === null || this._lastValue === null) && this.value !== this._lastValue // typeof null === 'object'
    ){
        result.type = true;
    }
    if('keys' in changesToTrack && keysAreDifferent(this._lastKeys, getKeys(value))){
        result.keys = true;
    }

    if(value !== null && typeof value === 'object' || typeof value === 'function'){
        var lastValue = this._lastValue;

        if('shallowStructure' in changesToTrack && (!lastValue || typeof lastValue !== 'object' || Object.keys(value).some(function(key, index){
            return value[key] !== lastValue[key];
        }))){
            result.shallowStructure = true;
        }
        if('structure' in changesToTrack && !deepEqual(value, lastValue)){
            result.structure = true;
        }
        if('reference' in changesToTrack && value !== this._lastReference){
            result.reference = true;
        }
    }

    this._lastValue = 'structure' in changesToTrack ? clone(value) : 'shallowStructure' in changesToTrack ? clone(value, true, 1): value;
    this._lastReference = value;
    this._lastKeys = newKeys;

    return result;
};

module.exports = WhatChanged;
},{"clone":27,"deep-equal":28}],27:[function(require,module,exports){
(function (Buffer){
var clone = (function() {
'use strict';

/**
 * Clones (copies) an Object using deep copying.
 *
 * This function supports circular references by default, but if you are certain
 * there are no circular references in your object, you can save some CPU time
 * by calling clone(obj, false).
 *
 * Caution: if `circular` is false and `parent` contains circular references,
 * your program may enter an infinite loop and crash.
 *
 * @param `parent` - the object to be cloned
 * @param `circular` - set to true if the object to be cloned may contain
 *    circular references. (optional - true by default)
 * @param `depth` - set to a number if the object is only to be cloned to
 *    a particular depth. (optional - defaults to Infinity)
 * @param `prototype` - sets the prototype to be used when cloning an object.
 *    (optional - defaults to parent prototype).
*/
function clone(parent, circular, depth, prototype) {
  var filter;
  if (typeof circular === 'object') {
    depth = circular.depth;
    prototype = circular.prototype;
    filter = circular.filter;
    circular = circular.circular
  }
  // maintain two arrays for circular references, where corresponding parents
  // and children have the same index
  var allParents = [];
  var allChildren = [];

  var useBuffer = typeof Buffer != 'undefined';

  if (typeof circular == 'undefined')
    circular = true;

  if (typeof depth == 'undefined')
    depth = Infinity;

  // recurse this function so we don't reset allParents and allChildren
  function _clone(parent, depth) {
    // cloning null always returns null
    if (parent === null)
      return null;

    if (depth == 0)
      return parent;

    var child;
    var proto;
    if (typeof parent != 'object') {
      return parent;
    }

    if (clone.__isArray(parent)) {
      child = [];
    } else if (clone.__isRegExp(parent)) {
      child = new RegExp(parent.source, __getRegExpFlags(parent));
      if (parent.lastIndex) child.lastIndex = parent.lastIndex;
    } else if (clone.__isDate(parent)) {
      child = new Date(parent.getTime());
    } else if (useBuffer && Buffer.isBuffer(parent)) {
      child = new Buffer(parent.length);
      parent.copy(child);
      return child;
    } else {
      if (typeof prototype == 'undefined') {
        proto = Object.getPrototypeOf(parent);
        child = Object.create(proto);
      }
      else {
        child = Object.create(prototype);
        proto = prototype;
      }
    }

    if (circular) {
      var index = allParents.indexOf(parent);

      if (index != -1) {
        return allChildren[index];
      }
      allParents.push(parent);
      allChildren.push(child);
    }

    for (var i in parent) {
      var attrs;
      if (proto) {
        attrs = Object.getOwnPropertyDescriptor(proto, i);
      }

      if (attrs && attrs.set == null) {
        continue;
      }
      child[i] = _clone(parent[i], depth - 1);
    }

    return child;
  }

  return _clone(parent, depth);
}

/**
 * Simple flat clone using prototype, accepts only objects, usefull for property
 * override on FLAT configuration object (no nested props).
 *
 * USE WITH CAUTION! This may not behave as you wish if you do not know how this
 * works.
 */
clone.clonePrototype = function clonePrototype(parent) {
  if (parent === null)
    return null;

  var c = function () {};
  c.prototype = parent;
  return new c();
};

// private utility functions

function __objToStr(o) {
  return Object.prototype.toString.call(o);
};
clone.__objToStr = __objToStr;

function __isDate(o) {
  return typeof o === 'object' && __objToStr(o) === '[object Date]';
};
clone.__isDate = __isDate;

function __isArray(o) {
  return typeof o === 'object' && __objToStr(o) === '[object Array]';
};
clone.__isArray = __isArray;

function __isRegExp(o) {
  return typeof o === 'object' && __objToStr(o) === '[object RegExp]';
};
clone.__isRegExp = __isRegExp;

function __getRegExpFlags(re) {
  var flags = '';
  if (re.global) flags += 'g';
  if (re.ignoreCase) flags += 'i';
  if (re.multiline) flags += 'm';
  return flags;
};
clone.__getRegExpFlags = __getRegExpFlags;

return clone;
})();

if (typeof module === 'object' && module.exports) {
  module.exports = clone;
}

}).call(this,require("buffer").Buffer)

},{"buffer":68}],28:[function(require,module,exports){
var pSlice = Array.prototype.slice;
var objectKeys = require('./lib/keys.js');
var isArguments = require('./lib/is_arguments.js');

var deepEqual = module.exports = function (actual, expected, opts) {
  if (!opts) opts = {};
  // 7.1. All identical values are equivalent, as determined by ===.
  if (actual === expected) {
    return true;

  } else if (actual instanceof Date && expected instanceof Date) {
    return actual.getTime() === expected.getTime();

  // 7.3. Other pairs that do not both pass typeof value == 'object',
  // equivalence is determined by ==.
  } else if (typeof actual != 'object' && typeof expected != 'object') {
    return opts.strict ? actual === expected : actual == expected;

  // 7.4. For all other Object pairs, including Array objects, equivalence is
  // determined by having the same number of owned properties (as verified
  // with Object.prototype.hasOwnProperty.call), the same set of keys
  // (although not necessarily the same order), equivalent values for every
  // corresponding key, and an identical 'prototype' property. Note: this
  // accounts for both named and indexed properties on Arrays.
  } else {
    return objEquiv(actual, expected, opts);
  }
}

function isUndefinedOrNull(value) {
  return value === null || value === undefined;
}

function isBuffer (x) {
  if (!x || typeof x !== 'object' || typeof x.length !== 'number') return false;
  if (typeof x.copy !== 'function' || typeof x.slice !== 'function') {
    return false;
  }
  if (x.length > 0 && typeof x[0] !== 'number') return false;
  return true;
}

function objEquiv(a, b, opts) {
  var i, key;
  if (isUndefinedOrNull(a) || isUndefinedOrNull(b))
    return false;
  // an identical 'prototype' property.
  if (a.prototype !== b.prototype) return false;
  //~~~I've managed to break Object.keys through screwy arguments passing.
  //   Converting to array solves the problem.
  if (isArguments(a)) {
    if (!isArguments(b)) {
      return false;
    }
    a = pSlice.call(a);
    b = pSlice.call(b);
    return deepEqual(a, b, opts);
  }
  if (isBuffer(a)) {
    if (!isBuffer(b)) {
      return false;
    }
    if (a.length !== b.length) return false;
    for (i = 0; i < a.length; i++) {
      if (a[i] !== b[i]) return false;
    }
    return true;
  }
  try {
    var ka = objectKeys(a),
        kb = objectKeys(b);
  } catch (e) {//happens when one is a string literal and the other isn't
    return false;
  }
  // having the same number of owned properties (keys incorporates
  // hasOwnProperty)
  if (ka.length != kb.length)
    return false;
  //the same set of keys (although not necessarily the same order),
  ka.sort();
  kb.sort();
  //~~~cheap key test
  for (i = ka.length - 1; i >= 0; i--) {
    if (ka[i] != kb[i])
      return false;
  }
  //equivalent values for every corresponding key, and
  //~~~possibly expensive deep test
  for (i = ka.length - 1; i >= 0; i--) {
    key = ka[i];
    if (!deepEqual(a[key], b[key], opts)) return false;
  }
  return typeof a === typeof b;
}

},{"./lib/is_arguments.js":29,"./lib/keys.js":30}],29:[function(require,module,exports){
var supportsArgumentsClass = (function(){
  return Object.prototype.toString.call(arguments)
})() == '[object Arguments]';

exports = module.exports = supportsArgumentsClass ? supported : unsupported;

exports.supported = supported;
function supported(object) {
  return Object.prototype.toString.call(object) == '[object Arguments]';
};

exports.unsupported = unsupported;
function unsupported(object){
  return object &&
    typeof object == 'object' &&
    typeof object.length == 'number' &&
    Object.prototype.hasOwnProperty.call(object, 'callee') &&
    !Object.prototype.propertyIsEnumerable.call(object, 'callee') ||
    false;
};

},{}],30:[function(require,module,exports){
exports = module.exports = typeof Object.keys === 'function'
  ? Object.keys : shim;

exports.shim = shim;
function shim (obj) {
  var keys = [];
  for (var key in obj) keys.push(key);
  return keys;
}

},{}],31:[function(require,module,exports){
var Enti = require('enti'),
    WhatChanged = require('what-changed'),
    same = require('same-value'),
    firmer = require('./firmer'),
    createBinding = require('./binding'),
    functionEmitter = require('./functionEmitter'),
    setPrototypeOf = require('setprototypeof'),
    is = require('./is');

var propertyProto = Object.create(functionEmitter);

propertyProto._fastn_property = true;
propertyProto._firm = 1;

function propertyTemplate(value){
    if(!arguments.length){
        return this.binding && this.binding() || this.property._value;
    }

    if(!this.destroyed){
        if(this.binding){
            this.binding(value);
            return this.property;
        }

        this.valueUpdate(value);
    }

    return this.property;
}

function changeChecker(current, changes){
    if(changes){
        var changes = new WhatChanged(current, changes);

        return function(value){
            return Object.keys(changes.update(value)).length > 0;
        };
    }else{
        var lastValue = current;
        return function(newValue){
            if(!same(lastValue, newValue)){
                lastValue = newValue;
                return true;
            }
        };
    }
}


function propertyBinding(newBinding){
    if(!arguments.length){
        return this.binding;
    }

    if(!is.binding(newBinding)){
        newBinding = createBinding(newBinding);
    }

    if(newBinding === this.binding){
        return this.property;
    }

    if(this.binding){
        this.binding.removeListener('change', this.valueUpdate);
    }

    this.binding = newBinding;

    if(this.model){
        this.property.attach(this.model, this.property._firm);
    }

    this.binding.on('change', this.valueUpdate);
    this.valueUpdate(this.binding());

    return this.property;
};

function attachProperty(object, firm){
    if(firmer(this.property, firm)){
        return this.property;
    }

    this.property._firm = firm;

    if(!(object instanceof Object)){
        object = {};
    }

    if(this.binding){
        this.model = object;
        this.binding.attach(object, 1);
    }

    if(this.property._events && 'attach' in this.property._events){
        this.property.emit('attach', object, 1);
    }

    return this.property;
};

function detachProperty(firm){
    if(firmer(this.property, firm)){
        return this.property;
    }

    if(this.binding){
        this.binding.removeListener('change', this.valueUpdate);
        this.binding.detach(1);
        this.model = null;
    }

    if(this.property._events && 'detach' in this.property._events){
        this.property.emit('detach', 1);
    }

    return this.property;
};

function updateProperty(){
    if(!this.destroyed){

        if(this.property._update){
            this.property._update(this.property._value, this.property);
        }

        this.property.emit('update', this.property._value);
    }
    return this.property;
};

function propertyUpdater(fn){
    if(!arguments.length){
        return this.property._update;
    }
    this.property._update = fn;
    return this.property;
};

function destroyProperty(){
    if(!this.destroyed){
        this.destroyed = true;

        this.property
            .removeAllListeners('change')
            .removeAllListeners('update')
            .removeAllListeners('attach');

        this.property.emit('destroy');
        this.property.detach();
        if(this.binding){
            this.binding.destroy(true);
        }
    }
    return this.property;
};

function propertyDestroyed(){
    return this.destroyed;
};

function addPropertyTo(component, key){
    component.setProperty(key, this.property);

    return this.property;
};

function createProperty(currentValue, changes, updater){
    if(typeof changes === 'function'){
        updater = changes;
        changes = null;
    }

    var propertyScope =
        property = propertyTemplate.bind(propertyScope)
        propertyScope = {
        hasChanged: changeChecker(currentValue, changes),
        valueUpdate: function(value){
            property._value = value;
            if(!propertyScope.hasChanged(value)){
                return;
            }
            property.emit('change', property._value);
            property.update();
        }
    };

    var property = propertyScope.property = propertyTemplate.bind(propertyScope);

    property._value = currentValue;
    property._update = updater;

    setPrototypeOf(property, propertyProto);

    property.binding = propertyBinding.bind(propertyScope);
    property.attach = attachProperty.bind(propertyScope);
    property.detach = detachProperty.bind(propertyScope);
    property.update = updateProperty.bind(propertyScope);
    property.updater = propertyUpdater.bind(propertyScope);
    property.destroy = destroyProperty.bind(propertyScope);
    property.destroyed = propertyDestroyed.bind(propertyScope);
    property.addTo = addPropertyTo.bind(propertyScope);

    return property;
};

module.exports = createProperty;
},{"./binding":11,"./firmer":14,"./functionEmitter":15,"./is":18,"enti":20,"same-value":22,"setprototypeof":25,"what-changed":26}],32:[function(require,module,exports){
var todo = [],
    todoKeys = [],
    scheduled,
    updates = 0;

function run(){
    var startTime = Date.now();

    while(todo.length && Date.now() - startTime < 16){
        todoKeys.shift();
        todo.shift()();
    }

    if(todo.length){
        requestAnimationFrame(run);
    }else{
        scheduled = false;
    }
}

function schedule(key, fn){
    if(~todoKeys.indexOf(key)){
        return;
    }

    todo.push(fn);
    todoKeys.push(key);

    if(!scheduled){
        scheduled = true;
        requestAnimationFrame(run);
    }
}

module.exports = schedule;
},{}],33:[function(require,module,exports){
function updateText(){
    if(!this.element){
        return;
    }

    var value = this.text();

    this.element.textContent = (value == null ? '' : value);
}

function autoRender(content){
    this.element = document.createTextNode(content);
}

function autoText(text, fastn, content) {
    text.render = autoRender.bind(text, content);

    return text;
}

function render(){
    this.element = this.createTextNode(this.text());
    this.emit('render');
};

function textComponent(fastn, component, type, settings, children){
    if(settings.auto){
        delete settings.auto;
        if(!fastn.isBinding(children[0])){
            return autoText(component, fastn, children[0]);
        }
        settings.text = children.pop();
    }

    component.createTextNode = textComponent.createTextNode;
    component.render = render.bind(component);

    component.setProperty('text', fastn.property('', updateText.bind(component)));

    return component;
}

textComponent.createTextNode = function(text){
    return document.createTextNode(text);
};

module.exports = textComponent;
},{}],34:[function(require,module,exports){
var doc = require('doc-js'),
    setify = require('setify'),
    naturalSelection = require('natural-selection');

function constructInsertString(element, insertValue){
    var result = '',
        value = element.value;

    if(naturalSelection(element)) {
        var start = element.selectionStart,
            end = element.selectionEnd;

        result = value.slice(0, start) + insertValue + value.slice(end);
    } else {
        result = value + insertValue;
    }

    return result;
}

function validateInput(testString, regex) {
    var newRegex = new RegExp(regex);

    return !!testString.match(newRegex);
}

function validateKey(event, regex) {
    var newChar = String.fromCharCode(event.which),
        testString = constructInsertString(event.target, newChar);

    if(!validateInput(testString, regex)){
        event.preventDefault();
    }
}

function validatePaste(event, regex){
    event.preventDefault();

    var element = event.target,
        pastedData = event.clipboardData.getData('Text'),
        maxLength = element.maxLength;

    pastedData = constructInsertString(element, pastedData);
    pastedData = pastedData.split('')
        .reduce(function(result, charater) {
            if(validateInput(result + charater, regex)){
                return result + charater;
            }

            return result;
        }, '');

    setify(element, pastedData);
}

var eventValidators = {
    'paste': validatePaste,
    'keypress': validateKey
};

var defaultValidators =  {
    '[type=email]': /^[^@]*$|^[^@]+@[^@]*$/,
    '[type=number]': /^\d*$|^\d*\.$|^\d*\.\d+$/
};

function parseRegex(regexString){
    var regexParts = regexString.match(/^\/(.*)\/(.*)$/);

    return regexParts && new RegExp(regexParts[1], regexParts[2]);
}

module.exports = function(settings) {
    var parentElement = settings.parentElement || document,
        validators = settings.validators || module.exports.defaultValidators(),
        selectors = Object.keys(validators).join(', ');

    function getValidatorKey(validatorKey) {
        if(doc.is(event.target, validatorKey)) {
            return validatorKey;
        }
    }

    function validateInput(event) {
        var validatorKey = Object.keys(validators).find(getValidatorKey);

        var validator = eventValidators[event.type],
            regex = validators[validatorKey];

        if(!validator || !regex) {
            return;
        }

        validator(event, regex);
    }

    doc(parentElement).on('paste keypress', selectors, validateInput);
};

module.exports.defaultValidators = function() {
    return Object.create(defaultValidators);
};

},{"doc-js":6,"natural-selection":35,"setify":36}],35:[function(require,module,exports){
arguments[4][24][0].apply(exports,arguments)
},{"dup":24}],36:[function(require,module,exports){
arguments[4][23][0].apply(exports,arguments)
},{"dup":23,"natural-selection":35}],37:[function(require,module,exports){
(function (process){
var defined = require('defined');
var createDefaultStream = require('./lib/default_stream');
var Test = require('./lib/test');
var createResult = require('./lib/results');
var through = require('through');

var canEmitExit = typeof process !== 'undefined' && process
    && typeof process.on === 'function' && process.browser !== true
;
var canExit = typeof process !== 'undefined' && process
    && typeof process.exit === 'function'
;

var nextTick = typeof setImmediate !== 'undefined'
    ? setImmediate
    : process.nextTick
;

exports = module.exports = (function () {
    var harness;
    var lazyLoad = function () {
        return getHarness().apply(this, arguments);
    };
    
    lazyLoad.only = function () {
        return getHarness().only.apply(this, arguments);
    };
    
    lazyLoad.createStream = function (opts) {
        if (!opts) opts = {};
        if (!harness) {
            var output = through();
            getHarness({ stream: output, objectMode: opts.objectMode });
            return output;
        }
        return harness.createStream(opts);
    };
    
    lazyLoad.onFinish = function () {
        return getHarness().onFinish.apply(this, arguments);
    };

    lazyLoad.getHarness = getHarness

    return lazyLoad

    function getHarness (opts) {
        if (!opts) opts = {};
        opts.autoclose = !canEmitExit;
        if (!harness) harness = createExitHarness(opts);
        return harness;
    }
})();

function createExitHarness (conf) {
    if (!conf) conf = {};
    var harness = createHarness({
        autoclose: defined(conf.autoclose, false)
    });
    
    var stream = harness.createStream({ objectMode: conf.objectMode });
    var es = stream.pipe(conf.stream || createDefaultStream());
    if (canEmitExit) {
        es.on('error', function (err) { harness._exitCode = 1 });
    }
    
    var ended = false;
    stream.on('end', function () { ended = true });
    
    if (conf.exit === false) return harness;
    if (!canEmitExit || !canExit) return harness;

    var inErrorState = false;

    process.on('exit', function (code) {
        // let the process exit cleanly.
        if (code !== 0) {
            return
        }

        if (!ended) {
            var only = harness._results._only;
            for (var i = 0; i < harness._tests.length; i++) {
                var t = harness._tests[i];
                if (only && t.name !== only) continue;
                t._exit();
            }
        }
        harness.close();
        process.exit(code || harness._exitCode);
    });
    
    return harness;
}

exports.createHarness = createHarness;
exports.Test = Test;
exports.test = exports; // tap compat
exports.test.skip = Test.skip;

var exitInterval;

function createHarness (conf_) {
    if (!conf_) conf_ = {};
    var results = createResult();
    if (conf_.autoclose !== false) {
        results.once('done', function () { results.close() });
    }
    
    var test = function (name, conf, cb) {
        var t = new Test(name, conf, cb);
        test._tests.push(t);
        
        (function inspectCode (st) {
            st.on('test', function sub (st_) {
                inspectCode(st_);
            });
            st.on('result', function (r) {
                if (!r.ok && typeof r !== 'string') test._exitCode = 1
            });
        })(t);
        
        results.push(t);
        return t;
    };
    test._results = results;
    
    test._tests = [];
    
    test.createStream = function (opts) {
        return results.createStream(opts);
    };

    test.onFinish = function (cb) {
        results.on('done', cb);
    };
    
    var only = false;
    test.only = function (name) {
        if (only) throw new Error('there can only be one only test');
        results.only(name);
        only = true;
        return test.apply(null, arguments);
    };
    test._exitCode = 0;
    
    test.close = function () { results.close() };
    
    return test;
}

}).call(this,require('_process'))

},{"./lib/default_stream":38,"./lib/results":39,"./lib/test":40,"_process":77,"defined":44,"through":65}],38:[function(require,module,exports){
(function (process){
var through = require('through');
var fs = require('fs');

module.exports = function () {
    var line = '';
    var stream = through(write, flush);
    return stream;
    
    function write (buf) {
        for (var i = 0; i < buf.length; i++) {
            var c = typeof buf === 'string'
                ? buf.charAt(i)
                : String.fromCharCode(buf[i])
            ;
            if (c === '\n') flush();
            else line += c;
        }
    }
    
    function flush () {
        if (fs.writeSync && /^win/.test(process.platform)) {
            try { fs.writeSync(1, line + '\n'); }
            catch (e) { stream.emit('error', e) }
        }
        else {
            try { console.log(line) }
            catch (e) { stream.emit('error', e) }
        }
        line = '';
    }
};

}).call(this,require('_process'))

},{"_process":77,"fs":66,"through":65}],39:[function(require,module,exports){
(function (process){
var EventEmitter = require('events').EventEmitter;
var inherits = require('inherits');
var through = require('through');
var resumer = require('resumer');
var inspect = require('object-inspect');
var bind = require('function-bind');
var has = require('has');
var regexpTest = bind.call(Function.call, RegExp.prototype.test);
var yamlIndicators = /\:|\-|\?/;
var nextTick = typeof setImmediate !== 'undefined'
    ? setImmediate
    : process.nextTick
;

module.exports = Results;
inherits(Results, EventEmitter);

function Results () {
    if (!(this instanceof Results)) return new Results;
    this.count = 0;
    this.fail = 0;
    this.pass = 0;
    this._stream = through();
    this.tests = [];
}

Results.prototype.createStream = function (opts) {
    if (!opts) opts = {};
    var self = this;
    var output, testId = 0;
    if (opts.objectMode) {
        output = through();
        self.on('_push', function ontest (t, extra) {
            if (!extra) extra = {};
            var id = testId++;
            t.once('prerun', function () {
                var row = {
                    type: 'test',
                    name: t.name,
                    id: id
                };
                if (has(extra, 'parent')) {
                    row.parent = extra.parent;
                }
                output.queue(row);
            });
            t.on('test', function (st) {
                ontest(st, { parent: id });
            });
            t.on('result', function (res) {
                res.test = id;
                res.type = 'assert';
                output.queue(res);
            });
            t.on('end', function () {
                output.queue({ type: 'end', test: id });
            });
        });
        self.on('done', function () { output.queue(null) });
    }
    else {
        output = resumer();
        output.queue('TAP version 13\n');
        self._stream.pipe(output);
    }
    
    nextTick(function next() {
        var t;
        while (t = getNextTest(self)) {
            t.run();
            if (!t.ended) return t.once('end', function(){ nextTick(next); });
        }
        self.emit('done');
    });
    
    return output;
};

Results.prototype.push = function (t) {
    var self = this;
    self.tests.push(t);
    self._watch(t);
    self.emit('_push', t);
};

Results.prototype.only = function (name) {
    this._only = name;
};

Results.prototype._watch = function (t) {
    var self = this;
    var write = function (s) { self._stream.queue(s) };
    t.once('prerun', function () {
        write('# ' + t.name + '\n');
    });
    
    t.on('result', function (res) {
        if (typeof res === 'string') {
            write('# ' + res + '\n');
            return;
        }
        write(encodeResult(res, self.count + 1));
        self.count ++;

        if (res.ok) self.pass ++
        else self.fail ++
    });
    
    t.on('test', function (st) { self._watch(st) });
};

Results.prototype.close = function () {
    var self = this;
    if (self.closed) self._stream.emit('error', new Error('ALREADY CLOSED'));
    self.closed = true;
    var write = function (s) { self._stream.queue(s) };
    
    write('\n1..' + self.count + '\n');
    write('# tests ' + self.count + '\n');
    write('# pass  ' + self.pass + '\n');
    if (self.fail) write('# fail  ' + self.fail + '\n')
    else write('\n# ok\n')

    self._stream.queue(null);
};

function encodeResult (res, count) {
    var output = '';
    output += (res.ok ? 'ok ' : 'not ok ') + count;
    output += res.name ? ' ' + res.name.toString().replace(/\s+/g, ' ') : '';
    
    if (res.skip) output += ' # SKIP';
    else if (res.todo) output += ' # TODO';
    
    output += '\n';
    if (res.ok) return output;
    
    var outer = '  ';
    var inner = outer + '  ';
    output += outer + '---\n';
    output += inner + 'operator: ' + res.operator + '\n';
    
    if (has(res, 'expected') || has(res, 'actual')) {
        var ex = inspect(res.expected);
        var ac = inspect(res.actual);
        
        if (Math.max(ex.length, ac.length) > 65 || invalidYaml(ex) || invalidYaml(ac)) {
            output += inner + 'expected: |-\n' + inner + '  ' + ex + '\n';
            output += inner + 'actual: |-\n' + inner + '  ' + ac + '\n';
        }
        else {
            output += inner + 'expected: ' + ex + '\n';
            output += inner + 'actual:   ' + ac + '\n';
        }
    }
    if (res.at) {
        output += inner + 'at: ' + res.at + '\n';
    }
    if (res.operator === 'error' && res.actual && res.actual.stack) {
        var lines = String(res.actual.stack).split('\n');
        output += inner + 'stack: |-\n';
        for (var i = 0; i < lines.length; i++) {
            output += inner + '  ' + lines[i] + '\n';
        }
    }
    
    output += outer + '...\n';
    return output;
}

function getNextTest (results) {
    if (!results._only) {
        return results.tests.shift();
    }
    
    do {
        var t = results.tests.shift();
        if (!t) continue;
        if (results._only === t.name) {
            return t;
        }
    } while (results.tests.length !== 0)
}

function invalidYaml (str) {
    return regexpTest(yamlIndicators, str);
}

}).call(this,require('_process'))

},{"_process":77,"events":72,"function-bind":45,"has":46,"inherits":47,"object-inspect":48,"resumer":49,"through":65}],40:[function(require,module,exports){
(function (process,__dirname){
var deepEqual = require('deep-equal');
var defined = require('defined');
var path = require('path');
var inherits = require('inherits');
var EventEmitter = require('events').EventEmitter;
var has = require('has');
var trim = require('string.prototype.trim');

module.exports = Test;

var nextTick = typeof setImmediate !== 'undefined'
    ? setImmediate
    : process.nextTick
;

inherits(Test, EventEmitter);

var getTestArgs = function (name_, opts_, cb_) {
    var name = '(anonymous)';
    var opts = {};
    var cb;

    for (var i = 0; i < arguments.length; i++) {
        var arg = arguments[i];
        var t = typeof arg;
        if (t === 'string') {
            name = arg;
        }
        else if (t === 'object') {
            opts = arg || opts;
        }
        else if (t === 'function') {
            cb = arg;
        }
    }
    return { name: name, opts: opts, cb: cb };
};

function Test (name_, opts_, cb_) {
    if (! (this instanceof Test)) {
        return new Test(name_, opts_, cb_);
    }

    var args = getTestArgs(name_, opts_, cb_);

    this.readable = true;
    this.name = args.name || '(anonymous)';
    this.assertCount = 0;
    this.pendingCount = 0;
    this._skip = args.opts.skip || false;
    this._timeout = args.opts.timeout;
    this._plan = undefined;
    this._cb = args.cb;
    this._progeny = [];
    this._ok = true;

    for (var prop in this) {
        this[prop] = (function bind(self, val) {
            if (typeof val === 'function') {
                return function bound() {
                    return val.apply(self, arguments);
                };
            }
            else return val;
        })(this, this[prop]);
    }
}

Test.prototype.run = function () {
    if (!this._cb || this._skip) {
        return this._end();
    }
    if (this._timeout != null) {
        this.timeoutAfter(this._timeout);
    }
    this.emit('prerun');
    this._cb(this);
    this.emit('run');
};

Test.prototype.test = function (name, opts, cb) {
    var self = this;
    var t = new Test(name, opts, cb);
    this._progeny.push(t);
    this.pendingCount++;
    this.emit('test', t);
    t.on('prerun', function () {
        self.assertCount++;
    })
    
    if (!self._pendingAsserts()) {
        nextTick(function () {
            self._end();
        });
    }
    
    nextTick(function() {
        if (!self._plan && self.pendingCount == self._progeny.length) {
            self._end();
        }
    });
};

Test.prototype.comment = function (msg) {
    this.emit('result', trim(msg).replace(/^#\s*/, ''));
};

Test.prototype.plan = function (n) {
    this._plan = n;
    this.emit('plan', n);
};

Test.prototype.timeoutAfter = function(ms) {
    if (!ms) throw new Error('timeoutAfter requires a timespan');
    var self = this;
    var timeout = setTimeout(function() {
        self.fail('test timed out after ' + ms + 'ms');
        self.end();
    }, ms);
    this.once('end', function() {
        clearTimeout(timeout);
    });
}

Test.prototype.end = function (err) { 
    var self = this;
    if (arguments.length >= 1 && !!err) {
        this.ifError(err);
    }
    
    if (this.calledEnd) {
        this.fail('.end() called twice');
    }
    this.calledEnd = true;
    this._end();
};

Test.prototype._end = function (err) {
    var self = this;
    if (this._progeny.length) {
        var t = this._progeny.shift();
        t.on('end', function () { self._end() });
        t.run();
        return;
    }
    
    if (!this.ended) this.emit('end');
    var pendingAsserts = this._pendingAsserts();
    if (!this._planError && this._plan !== undefined && pendingAsserts) {
        this._planError = true;
        this.fail('plan != count', {
            expected : this._plan,
            actual : this.assertCount
        });
    }
    this.ended = true;
};

Test.prototype._exit = function () {
    if (this._plan !== undefined &&
        !this._planError && this.assertCount !== this._plan) {
        this._planError = true;
        this.fail('plan != count', {
            expected : this._plan,
            actual : this.assertCount,
            exiting : true
        });
    }
    else if (!this.ended) {
        this.fail('test exited without ending', {
            exiting: true
        });
    }
};

Test.prototype._pendingAsserts = function () {
    if (this._plan === undefined) {
        return 1;
    }
    else {
        return this._plan - (this._progeny.length + this.assertCount);
    }
};

Test.prototype._assert = function assert (ok, opts) {
    var self = this;
    var extra = opts.extra || {};
    
    var res = {
        id : self.assertCount ++,
        ok : Boolean(ok),
        skip : defined(extra.skip, opts.skip),
        name : defined(extra.message, opts.message, '(unnamed assert)'),
        operator : defined(extra.operator, opts.operator)
    };
    if (has(opts, 'actual') || has(extra, 'actual')) {
        res.actual = defined(extra.actual, opts.actual);
    }
    if (has(opts, 'expected') || has(extra, 'expected')) {
        res.expected = defined(extra.expected, opts.expected);
    }
    this._ok = Boolean(this._ok && ok);
    
    if (!ok) {
        res.error = defined(extra.error, opts.error, new Error(res.name));
    }
    
    if (!ok) {
        var e = new Error('exception');
        var err = (e.stack || '').split('\n');
        var dir = path.dirname(__dirname) + '/';
        
        for (var i = 0; i < err.length; i++) {
            var m = /^[^\s]*\s*\bat\s+(.+)/.exec(err[i]);
            if (!m) {
                continue;
            }
            
            var s = m[1].split(/\s+/);
            var filem = /(\/[^:\s]+:(\d+)(?::(\d+))?)/.exec(s[1]);
            if (!filem) {
                filem = /(\/[^:\s]+:(\d+)(?::(\d+))?)/.exec(s[2]);
                
                if (!filem) {
                    filem = /(\/[^:\s]+:(\d+)(?::(\d+))?)/.exec(s[3]);

                    if (!filem) {
                        continue;
                    }
                }
            }
            
            if (filem[1].slice(0, dir.length) === dir) {
                continue;
            }
            
            res.functionName = s[0];
            res.file = filem[1];
            res.line = Number(filem[2]);
            if (filem[3]) res.column = filem[3];
            
            res.at = m[1];
            break;
        }
    }

    self.emit('result', res);
    
    var pendingAsserts = self._pendingAsserts();
    if (!pendingAsserts) {
        if (extra.exiting) {
            self._end();
        } else {
            nextTick(function () {
                self._end();
            });
        }
    }
    
    if (!self._planError && pendingAsserts < 0) {
        self._planError = true;
        self.fail('plan != count', {
            expected : self._plan,
            actual : self._plan - pendingAsserts
        });
    }
};

Test.prototype.fail = function (msg, extra) {
    this._assert(false, {
        message : msg,
        operator : 'fail',
        extra : extra
    });
};

Test.prototype.pass = function (msg, extra) {
    this._assert(true, {
        message : msg,
        operator : 'pass',
        extra : extra
    });
};

Test.prototype.skip = function (msg, extra) {
    this._assert(true, {
        message : msg,
        operator : 'skip',
        skip : true,
        extra : extra
    });
};

Test.prototype.ok
= Test.prototype['true']
= Test.prototype.assert
= function (value, msg, extra) {
    this._assert(value, {
        message : msg,
        operator : 'ok',
        expected : true,
        actual : value,
        extra : extra
    });
};

Test.prototype.notOk
= Test.prototype['false']
= Test.prototype.notok
= function (value, msg, extra) {
    this._assert(!value, {
        message : msg,
        operator : 'notOk',
        expected : false,
        actual : value,
        extra : extra
    });
};

Test.prototype.error
= Test.prototype.ifError
= Test.prototype.ifErr
= Test.prototype.iferror
= function (err, msg, extra) {
    this._assert(!err, {
        message : defined(msg, String(err)),
        operator : 'error',
        actual : err,
        extra : extra
    });
};

Test.prototype.equal
= Test.prototype.equals
= Test.prototype.isEqual
= Test.prototype.is
= Test.prototype.strictEqual
= Test.prototype.strictEquals
= function (a, b, msg, extra) {
    this._assert(a === b, {
        message : defined(msg, 'should be equal'),
        operator : 'equal',
        actual : a,
        expected : b,
        extra : extra
    });
};

Test.prototype.notEqual
= Test.prototype.notEquals
= Test.prototype.notStrictEqual
= Test.prototype.notStrictEquals
= Test.prototype.isNotEqual
= Test.prototype.isNot
= Test.prototype.not
= Test.prototype.doesNotEqual
= Test.prototype.isInequal
= function (a, b, msg, extra) {
    this._assert(a !== b, {
        message : defined(msg, 'should not be equal'),
        operator : 'notEqual',
        actual : a,
        notExpected : b,
        extra : extra
    });
};

Test.prototype.deepEqual
= Test.prototype.deepEquals
= Test.prototype.isEquivalent
= Test.prototype.same
= function (a, b, msg, extra) {
    this._assert(deepEqual(a, b, { strict: true }), {
        message : defined(msg, 'should be equivalent'),
        operator : 'deepEqual',
        actual : a,
        expected : b,
        extra : extra
    });
};

Test.prototype.deepLooseEqual
= Test.prototype.looseEqual
= Test.prototype.looseEquals
= function (a, b, msg, extra) {
    this._assert(deepEqual(a, b), {
        message : defined(msg, 'should be equivalent'),
        operator : 'deepLooseEqual',
        actual : a,
        expected : b,
        extra : extra
    });
};

Test.prototype.notDeepEqual
= Test.prototype.notEquivalent
= Test.prototype.notDeeply
= Test.prototype.notSame
= Test.prototype.isNotDeepEqual
= Test.prototype.isNotDeeply
= Test.prototype.isNotEquivalent
= Test.prototype.isInequivalent
= function (a, b, msg, extra) {
    this._assert(!deepEqual(a, b, { strict: true }), {
        message : defined(msg, 'should not be equivalent'),
        operator : 'notDeepEqual',
        actual : a,
        notExpected : b,
        extra : extra
    });
};

Test.prototype.notDeepLooseEqual
= Test.prototype.notLooseEqual
= Test.prototype.notLooseEquals
= function (a, b, msg, extra) {
    this._assert(!deepEqual(a, b), {
        message : defined(msg, 'should be equivalent'),
        operator : 'notDeepLooseEqual',
        actual : a,
        expected : b,
        extra : extra
    });
};

Test.prototype['throws'] = function (fn, expected, msg, extra) {
    if (typeof expected === 'string') {
        msg = expected;
        expected = undefined;
    }

    var caught = undefined;

    try {
        fn();
    } catch (err) {
        caught = { error : err };
        var message = err.message;
        delete err.message;
        err.message = message;
    }

    var passed = caught;

    if (expected instanceof RegExp) {
        passed = expected.test(caught && caught.error);
        expected = String(expected);
    }

    if (typeof expected === 'function' && caught) {
        passed = caught.error instanceof expected;
        caught.error = caught.error.constructor;
    }

    this._assert(passed, {
        message : defined(msg, 'should throw'),
        operator : 'throws',
        actual : caught && caught.error,
        expected : expected,
        error: !passed && caught && caught.error,
        extra : extra
    });
};

Test.prototype.doesNotThrow = function (fn, expected, msg, extra) {
    if (typeof expected === 'string') {
        msg = expected;
        expected = undefined;
    }
    var caught = undefined;
    try {
        fn();
    }
    catch (err) {
        caught = { error : err };
    }
    this._assert(!caught, {
        message : defined(msg, 'should not throw'),
        operator : 'throws',
        actual : caught && caught.error,
        expected : expected,
        error : caught && caught.error,
        extra : extra
    });
};

Test.skip = function (name_, _opts, _cb) {
    var args = getTestArgs.apply(null, arguments);
    args.opts.skip = true;
    return Test(args.name, args.opts, args.cb);
};

// vim: set softtabstop=4 shiftwidth=4:


}).call(this,require('_process'),"/node_modules/tape/lib")

},{"_process":77,"deep-equal":41,"defined":44,"events":72,"has":46,"inherits":47,"path":76,"string.prototype.trim":51}],41:[function(require,module,exports){
var pSlice = Array.prototype.slice;
var objectKeys = require('./lib/keys.js');
var isArguments = require('./lib/is_arguments.js');

var deepEqual = module.exports = function (actual, expected, opts) {
  if (!opts) opts = {};
  // 7.1. All identical values are equivalent, as determined by ===.
  if (actual === expected) {
    return true;

  } else if (actual instanceof Date && expected instanceof Date) {
    return actual.getTime() === expected.getTime();

  // 7.3. Other pairs that do not both pass typeof value == 'object',
  // equivalence is determined by ==.
  } else if (!actual || !expected || typeof actual != 'object' && typeof expected != 'object') {
    return opts.strict ? actual === expected : actual == expected;

  // 7.4. For all other Object pairs, including Array objects, equivalence is
  // determined by having the same number of owned properties (as verified
  // with Object.prototype.hasOwnProperty.call), the same set of keys
  // (although not necessarily the same order), equivalent values for every
  // corresponding key, and an identical 'prototype' property. Note: this
  // accounts for both named and indexed properties on Arrays.
  } else {
    return objEquiv(actual, expected, opts);
  }
}

function isUndefinedOrNull(value) {
  return value === null || value === undefined;
}

function isBuffer (x) {
  if (!x || typeof x !== 'object' || typeof x.length !== 'number') return false;
  if (typeof x.copy !== 'function' || typeof x.slice !== 'function') {
    return false;
  }
  if (x.length > 0 && typeof x[0] !== 'number') return false;
  return true;
}

function objEquiv(a, b, opts) {
  var i, key;
  if (isUndefinedOrNull(a) || isUndefinedOrNull(b))
    return false;
  // an identical 'prototype' property.
  if (a.prototype !== b.prototype) return false;
  //~~~I've managed to break Object.keys through screwy arguments passing.
  //   Converting to array solves the problem.
  if (isArguments(a)) {
    if (!isArguments(b)) {
      return false;
    }
    a = pSlice.call(a);
    b = pSlice.call(b);
    return deepEqual(a, b, opts);
  }
  if (isBuffer(a)) {
    if (!isBuffer(b)) {
      return false;
    }
    if (a.length !== b.length) return false;
    for (i = 0; i < a.length; i++) {
      if (a[i] !== b[i]) return false;
    }
    return true;
  }
  try {
    var ka = objectKeys(a),
        kb = objectKeys(b);
  } catch (e) {//happens when one is a string literal and the other isn't
    return false;
  }
  // having the same number of owned properties (keys incorporates
  // hasOwnProperty)
  if (ka.length != kb.length)
    return false;
  //the same set of keys (although not necessarily the same order),
  ka.sort();
  kb.sort();
  //~~~cheap key test
  for (i = ka.length - 1; i >= 0; i--) {
    if (ka[i] != kb[i])
      return false;
  }
  //equivalent values for every corresponding key, and
  //~~~possibly expensive deep test
  for (i = ka.length - 1; i >= 0; i--) {
    key = ka[i];
    if (!deepEqual(a[key], b[key], opts)) return false;
  }
  return typeof a === typeof b;
}

},{"./lib/is_arguments.js":42,"./lib/keys.js":43}],42:[function(require,module,exports){
arguments[4][29][0].apply(exports,arguments)
},{"dup":29}],43:[function(require,module,exports){
arguments[4][30][0].apply(exports,arguments)
},{"dup":30}],44:[function(require,module,exports){
module.exports = function () {
    for (var i = 0; i < arguments.length; i++) {
        if (arguments[i] !== undefined) return arguments[i];
    }
};

},{}],45:[function(require,module,exports){
var ERROR_MESSAGE = 'Function.prototype.bind called on incompatible ';
var slice = Array.prototype.slice;
var toStr = Object.prototype.toString;
var funcType = '[object Function]';

module.exports = function bind(that) {
    var target = this;
    if (typeof target !== 'function' || toStr.call(target) !== funcType) {
        throw new TypeError(ERROR_MESSAGE + target);
    }
    var args = slice.call(arguments, 1);

    var binder = function () {
        if (this instanceof bound) {
            var result = target.apply(
                this,
                args.concat(slice.call(arguments))
            );
            if (Object(result) === result) {
                return result;
            }
            return this;
        } else {
            return target.apply(
                that,
                args.concat(slice.call(arguments))
            );
        }
    };

    var boundLength = Math.max(0, target.length - args.length);
    var boundArgs = [];
    for (var i = 0; i < boundLength; i++) {
        boundArgs.push('$' + i);
    }

    var bound = Function('binder', 'return function (' + boundArgs.join(',') + '){ return binder.apply(this,arguments); }')(binder);

    if (target.prototype) {
        var Empty = function Empty() {};
        Empty.prototype = target.prototype;
        bound.prototype = new Empty();
        Empty.prototype = null;
    }

    return bound;
};


},{}],46:[function(require,module,exports){
var bind = require('function-bind');

module.exports = bind.call(Function.call, Object.prototype.hasOwnProperty);

},{"function-bind":45}],47:[function(require,module,exports){
if (typeof Object.create === 'function') {
  // implementation from standard node.js 'util' module
  module.exports = function inherits(ctor, superCtor) {
    ctor.super_ = superCtor
    ctor.prototype = Object.create(superCtor.prototype, {
      constructor: {
        value: ctor,
        enumerable: false,
        writable: true,
        configurable: true
      }
    });
  };
} else {
  // old school shim for old browsers
  module.exports = function inherits(ctor, superCtor) {
    ctor.super_ = superCtor
    var TempCtor = function () {}
    TempCtor.prototype = superCtor.prototype
    ctor.prototype = new TempCtor()
    ctor.prototype.constructor = ctor
  }
}

},{}],48:[function(require,module,exports){
module.exports = function inspect_ (obj, opts, depth, seen) {
    if (!opts) opts = {};
    
    var maxDepth = opts.depth === undefined ? 5 : opts.depth;
    if (depth === undefined) depth = 0;
    if (depth >= maxDepth && maxDepth > 0
    && obj && typeof obj === 'object') {
        return '[Object]';
    }
    
    if (seen === undefined) seen = [];
    else if (indexOf(seen, obj) >= 0) {
        return '[Circular]';
    }
    
    function inspect (value, from) {
        if (from) {
            seen = seen.slice();
            seen.push(from);
        }
        return inspect_(value, opts, depth + 1, seen);
    }
    
    if (typeof obj === 'string') {
        return inspectString(obj);
    }
    else if (typeof obj === 'function') {
        var name = nameOf(obj);
        return '[Function' + (name ? ': ' + name : '') + ']';
    }
    else if (obj === null) {
        return 'null';
    }
    else if (isSymbol(obj)) {
        var symString = Symbol.prototype.toString.call(obj);
        return typeof obj === 'object' ? 'Object(' + symString + ')' : symString;
    }
    else if (isElement(obj)) {
        var s = '<' + String(obj.nodeName).toLowerCase();
        var attrs = obj.attributes || [];
        for (var i = 0; i < attrs.length; i++) {
            s += ' ' + attrs[i].name + '="' + quote(attrs[i].value) + '"';
        }
        s += '>';
        if (obj.childNodes && obj.childNodes.length) s += '...';
        s += '</' + String(obj.nodeName).toLowerCase() + '>';
        return s;
    }
    else if (isArray(obj)) {
        if (obj.length === 0) return '[]';
        var xs = Array(obj.length);
        for (var i = 0; i < obj.length; i++) {
            xs[i] = has(obj, i) ? inspect(obj[i], obj) : '';
        }
        return '[ ' + xs.join(', ') + ' ]';
    }
    else if (isError(obj)) {
        var parts = [];
        for (var key in obj) {
            if (!has(obj, key)) continue;
            
            if (/[^\w$]/.test(key)) {
                parts.push(inspect(key) + ': ' + inspect(obj[key]));
            }
            else {
                parts.push(key + ': ' + inspect(obj[key]));
            }
        }
        if (parts.length === 0) return '[' + obj + ']';
        return '{ [' + obj + '] ' + parts.join(', ') + ' }';
    }
    else if (typeof obj === 'object' && typeof obj.inspect === 'function') {
        return obj.inspect();
    }
    else if (typeof obj === 'object' && !isDate(obj) && !isRegExp(obj)) {
        var xs = [], keys = [];
        for (var key in obj) {
            if (has(obj, key)) keys.push(key);
        }
        keys.sort();
        for (var i = 0; i < keys.length; i++) {
            var key = keys[i];
            if (/[^\w$]/.test(key)) {
                xs.push(inspect(key) + ': ' + inspect(obj[key], obj));
            }
            else xs.push(key + ': ' + inspect(obj[key], obj));
        }
        if (xs.length === 0) return '{}';
        return '{ ' + xs.join(', ') + ' }';
    }
    else return String(obj);
};

function quote (s) {
    return String(s).replace(/"/g, '&quot;');
}

function isArray (obj) { return toStr(obj) === '[object Array]' }
function isDate (obj) { return toStr(obj) === '[object Date]' }
function isRegExp (obj) { return toStr(obj) === '[object RegExp]' }
function isError (obj) { return toStr(obj) === '[object Error]' }
function isSymbol (obj) { return toStr(obj) === '[object Symbol]' }

var hasOwn = Object.prototype.hasOwnProperty || function (key) { return key in this; };
function has (obj, key) {
    return hasOwn.call(obj, key);
}

function toStr (obj) {
    return Object.prototype.toString.call(obj);
}

function nameOf (f) {
    if (f.name) return f.name;
    var m = f.toString().match(/^function\s*([\w$]+)/);
    if (m) return m[1];
}

function indexOf (xs, x) {
    if (xs.indexOf) return xs.indexOf(x);
    for (var i = 0, l = xs.length; i < l; i++) {
        if (xs[i] === x) return i;
    }
    return -1;
}

function isElement (x) {
    if (!x || typeof x !== 'object') return false;
    if (typeof HTMLElement !== 'undefined' && x instanceof HTMLElement) {
        return true;
    }
    return typeof x.nodeName === 'string'
        && typeof x.getAttribute === 'function'
    ;
}

function inspectString (str) {
    var s = str.replace(/(['\\])/g, '\\$1').replace(/[\x00-\x1f]/g, lowbyte);
    return "'" + s + "'";
    
    function lowbyte (c) {
        var n = c.charCodeAt(0);
        var x = { 8: 'b', 9: 't', 10: 'n', 12: 'f', 13: 'r' }[n];
        if (x) return '\\' + x;
        return '\\x' + (n < 0x10 ? '0' : '') + n.toString(16);
    }
}

},{}],49:[function(require,module,exports){
(function (process){
var through = require('through');
var nextTick = typeof setImmediate !== 'undefined'
    ? setImmediate
    : process.nextTick
;

module.exports = function (write, end) {
    var tr = through(write, end);
    tr.pause();
    var resume = tr.resume;
    var pause = tr.pause;
    var paused = false;
    
    tr.pause = function () {
        paused = true;
        return pause.apply(this, arguments);
    };
    
    tr.resume = function () {
        paused = false;
        return resume.apply(this, arguments);
    };
    
    nextTick(function () {
        if (!paused) tr.resume();
    });
    
    return tr;
};

}).call(this,require('_process'))

},{"_process":77,"through":65}],50:[function(require,module,exports){
'use strict';

var bind = require('function-bind');
var ES = require('es-abstract/es5');
var replace = bind.call(Function.call, String.prototype.replace);

var leftWhitespace = /^[\x09\x0A\x0B\x0C\x0D\x20\xA0\u1680\u180E\u2000\u2001\u2002\u2003\u2004\u2005\u2006\u2007\u2008\u2009\u200A\u202F\u205F\u3000\u2028\u2029\uFEFF]+/;
var rightWhitespace = /[\x09\x0A\x0B\x0C\x0D\x20\xA0\u1680\u180E\u2000\u2001\u2002\u2003\u2004\u2005\u2006\u2007\u2008\u2009\u200A\u202F\u205F\u3000\u2028\u2029\uFEFF]+$/;

module.exports = function trim() {
	var S = ES.ToString(ES.CheckObjectCoercible(this));
	return replace(replace(S, leftWhitespace, ''), rightWhitespace, '');
};

},{"es-abstract/es5":56,"function-bind":45}],51:[function(require,module,exports){
'use strict';

var bind = require('function-bind');
var define = require('define-properties');

var implementation = require('./implementation');
var getPolyfill = require('./polyfill');
var shim = require('./shim');

var boundTrim = bind.call(Function.call, implementation);

define(boundTrim, {
	getPolyfill: getPolyfill,
	implementation: implementation,
	shim: shim
});

module.exports = boundTrim;

},{"./implementation":50,"./polyfill":63,"./shim":64,"define-properties":52,"function-bind":45}],52:[function(require,module,exports){
'use strict';

var keys = require('object-keys');
var foreach = require('foreach');
var hasSymbols = typeof Symbol === 'function' && typeof Symbol() === 'symbol';

var toStr = Object.prototype.toString;

var isFunction = function (fn) {
	return typeof fn === 'function' && toStr.call(fn) === '[object Function]';
};

var arePropertyDescriptorsSupported = function () {
	var obj = {};
	try {
		Object.defineProperty(obj, 'x', { enumerable: false, value: obj });
        /* eslint-disable no-unused-vars, no-restricted-syntax */
        for (var _ in obj) { return false; }
        /* eslint-enable no-unused-vars, no-restricted-syntax */
		return obj.x === obj;
	} catch (e) { /* this is IE 8. */
		return false;
	}
};
var supportsDescriptors = Object.defineProperty && arePropertyDescriptorsSupported();

var defineProperty = function (object, name, value, predicate) {
	if (name in object && (!isFunction(predicate) || !predicate())) {
		return;
	}
	if (supportsDescriptors) {
		Object.defineProperty(object, name, {
			configurable: true,
			enumerable: false,
			value: value,
			writable: true
		});
	} else {
		object[name] = value;
	}
};

var defineProperties = function (object, map) {
	var predicates = arguments.length > 2 ? arguments[2] : {};
	var props = keys(map);
	if (hasSymbols) {
		props = props.concat(Object.getOwnPropertySymbols(map));
	}
	foreach(props, function (name) {
		defineProperty(object, name, map[name], predicates[name]);
	});
};

defineProperties.supportsDescriptors = !!supportsDescriptors;

module.exports = defineProperties;

},{"foreach":53,"object-keys":54}],53:[function(require,module,exports){

var hasOwn = Object.prototype.hasOwnProperty;
var toString = Object.prototype.toString;

module.exports = function forEach (obj, fn, ctx) {
    if (toString.call(fn) !== '[object Function]') {
        throw new TypeError('iterator must be a function');
    }
    var l = obj.length;
    if (l === +l) {
        for (var i = 0; i < l; i++) {
            fn.call(ctx, obj[i], i, obj);
        }
    } else {
        for (var k in obj) {
            if (hasOwn.call(obj, k)) {
                fn.call(ctx, obj[k], k, obj);
            }
        }
    }
};


},{}],54:[function(require,module,exports){
'use strict';

// modified from https://github.com/es-shims/es5-shim
var has = Object.prototype.hasOwnProperty;
var toStr = Object.prototype.toString;
var slice = Array.prototype.slice;
var isArgs = require('./isArguments');
var hasDontEnumBug = !({ toString: null }).propertyIsEnumerable('toString');
var hasProtoEnumBug = function () {}.propertyIsEnumerable('prototype');
var dontEnums = [
	'toString',
	'toLocaleString',
	'valueOf',
	'hasOwnProperty',
	'isPrototypeOf',
	'propertyIsEnumerable',
	'constructor'
];
var equalsConstructorPrototype = function (o) {
	var ctor = o.constructor;
	return ctor && ctor.prototype === o;
};
var blacklistedKeys = {
	$console: true,
	$frame: true,
	$frameElement: true,
	$frames: true,
	$parent: true,
	$self: true,
	$webkitIndexedDB: true,
	$webkitStorageInfo: true,
	$window: true
};
var hasAutomationEqualityBug = (function () {
	/* global window */
	if (typeof window === 'undefined') { return false; }
	for (var k in window) {
		try {
			if (!blacklistedKeys['$' + k] && has.call(window, k) && window[k] !== null && typeof window[k] === 'object') {
				try {
					equalsConstructorPrototype(window[k]);
				} catch (e) {
					return true;
				}
			}
		} catch (e) {
			return true;
		}
	}
	return false;
}());
var equalsConstructorPrototypeIfNotBuggy = function (o) {
	/* global window */
	if (typeof window === 'undefined' || !hasAutomationEqualityBug) {
		return equalsConstructorPrototype(o);
	}
	try {
		return equalsConstructorPrototype(o);
	} catch (e) {
		return false;
	}
};

var keysShim = function keys(object) {
	var isObject = object !== null && typeof object === 'object';
	var isFunction = toStr.call(object) === '[object Function]';
	var isArguments = isArgs(object);
	var isString = isObject && toStr.call(object) === '[object String]';
	var theKeys = [];

	if (!isObject && !isFunction && !isArguments) {
		throw new TypeError('Object.keys called on a non-object');
	}

	var skipProto = hasProtoEnumBug && isFunction;
	if (isString && object.length > 0 && !has.call(object, 0)) {
		for (var i = 0; i < object.length; ++i) {
			theKeys.push(String(i));
		}
	}

	if (isArguments && object.length > 0) {
		for (var j = 0; j < object.length; ++j) {
			theKeys.push(String(j));
		}
	} else {
		for (var name in object) {
			if (!(skipProto && name === 'prototype') && has.call(object, name)) {
				theKeys.push(String(name));
			}
		}
	}

	if (hasDontEnumBug) {
		var skipConstructor = equalsConstructorPrototypeIfNotBuggy(object);

		for (var k = 0; k < dontEnums.length; ++k) {
			if (!(skipConstructor && dontEnums[k] === 'constructor') && has.call(object, dontEnums[k])) {
				theKeys.push(dontEnums[k]);
			}
		}
	}
	return theKeys;
};

keysShim.shim = function shimObjectKeys() {
	if (Object.keys) {
		var keysWorksWithArguments = (function () {
			// Safari 5.0 bug
			return (Object.keys(arguments) || '').length === 2;
		}(1, 2));
		if (!keysWorksWithArguments) {
			var originalKeys = Object.keys;
			Object.keys = function keys(object) {
				if (isArgs(object)) {
					return originalKeys(slice.call(object));
				} else {
					return originalKeys(object);
				}
			};
		}
	} else {
		Object.keys = keysShim;
	}
	return Object.keys || keysShim;
};

module.exports = keysShim;

},{"./isArguments":55}],55:[function(require,module,exports){
'use strict';

var toStr = Object.prototype.toString;

module.exports = function isArguments(value) {
	var str = toStr.call(value);
	var isArgs = str === '[object Arguments]';
	if (!isArgs) {
		isArgs = str !== '[object Array]' &&
			value !== null &&
			typeof value === 'object' &&
			typeof value.length === 'number' &&
			value.length >= 0 &&
			toStr.call(value.callee) === '[object Function]';
	}
	return isArgs;
};

},{}],56:[function(require,module,exports){
'use strict';

var $isNaN = Number.isNaN || function (a) { return a !== a; };
var $isFinite = require('./helpers/isFinite');

var sign = require('./helpers/sign');
var mod = require('./helpers/mod');

var IsCallable = require('is-callable');
var toPrimitive = require('es-to-primitive/es5');

// https://es5.github.io/#x9
var ES5 = {
	ToPrimitive: toPrimitive,

	ToBoolean: function ToBoolean(value) {
		return Boolean(value);
	},
	ToNumber: function ToNumber(value) {
		return Number(value);
	},
	ToInteger: function ToInteger(value) {
		var number = this.ToNumber(value);
		if ($isNaN(number)) { return 0; }
		if (number === 0 || !$isFinite(number)) { return number; }
		return sign(number) * Math.floor(Math.abs(number));
	},
	ToInt32: function ToInt32(x) {
		return this.ToNumber(x) >> 0;
	},
	ToUint32: function ToUint32(x) {
		return this.ToNumber(x) >>> 0;
	},
	ToUint16: function ToUint16(value) {
		var number = this.ToNumber(value);
		if ($isNaN(number) || number === 0 || !$isFinite(number)) { return 0; }
		var posInt = sign(number) * Math.floor(Math.abs(number));
		return mod(posInt, 0x10000);
	},
	ToString: function ToString(value) {
		return String(value);
	},
	ToObject: function ToObject(value) {
		this.CheckObjectCoercible(value);
		return Object(value);
	},
	CheckObjectCoercible: function CheckObjectCoercible(value, optMessage) {
		/* jshint eqnull:true */
		if (value == null) {
			throw new TypeError(optMessage || 'Cannot call method on ' + value);
		}
		return value;
	},
	IsCallable: IsCallable,
	SameValue: function SameValue(x, y) {
		if (x === y) { // 0 === -0, but they are not identical.
			if (x === 0) { return 1 / x === 1 / y; }
			return true;
		}
        return $isNaN(x) && $isNaN(y);
	}
};

module.exports = ES5;

},{"./helpers/isFinite":57,"./helpers/mod":58,"./helpers/sign":59,"es-to-primitive/es5":60,"is-callable":62}],57:[function(require,module,exports){
var $isNaN = Number.isNaN || function (a) { return a !== a; };

module.exports = Number.isFinite || function (x) { return typeof x === 'number' && !$isNaN(x) && x !== Infinity && x !== -Infinity; };

},{}],58:[function(require,module,exports){
module.exports = function mod(number, modulo) {
	var remain = number % modulo;
	return Math.floor(remain >= 0 ? remain : remain + modulo);
};

},{}],59:[function(require,module,exports){
module.exports = function sign(number) {
	return number >= 0 ? 1 : -1;
};

},{}],60:[function(require,module,exports){
'use strict';

var toStr = Object.prototype.toString;

var isPrimitive = require('./helpers/isPrimitive');

var isCallable = require('is-callable');

// https://es5.github.io/#x8.12
var ES5internalSlots = {
	'[[DefaultValue]]': function (O, hint) {
		var actualHint = hint || (toStr.call(O) === '[object Date]' ? String : Number);

		if (actualHint === String || actualHint === Number) {
			var methods = actualHint === String ? ['toString', 'valueOf'] : ['valueOf', 'toString'];
			var value, i;
			for (i = 0; i < methods.length; ++i) {
				if (isCallable(O[methods[i]])) {
					value = O[methods[i]]();
					if (isPrimitive(value)) {
						return value;
					}
				}
			}
			throw new TypeError('No default value');
		}
		throw new TypeError('invalid [[DefaultValue]] hint supplied');
	}
};

// https://es5.github.io/#x9
module.exports = function ToPrimitive(input, PreferredType) {
	if (isPrimitive(input)) {
		return input;
	}
	return ES5internalSlots['[[DefaultValue]]'](input, PreferredType);
};

},{"./helpers/isPrimitive":61,"is-callable":62}],61:[function(require,module,exports){
module.exports = function isPrimitive(value) {
	return value === null || (typeof value !== 'function' && typeof value !== 'object');
};

},{}],62:[function(require,module,exports){
'use strict';

var fnToStr = Function.prototype.toString;

var constructorRegex = /\s*class /;
var isES6ClassFn = function isES6ClassFn(value) {
	try {
		var fnStr = fnToStr.call(value);
		var singleStripped = fnStr.replace(/\/\/.*\n/g, '');
		var multiStripped = singleStripped.replace(/\/\*[.\s\S]*\*\//g, '');
		var spaceStripped = multiStripped.replace(/\n/mg, ' ').replace(/ {2}/g, ' ');
		return constructorRegex.test(spaceStripped);
	} catch (e) {
		return false; // not a function
	}
};

var tryFunctionObject = function tryFunctionObject(value) {
	try {
		if (isES6ClassFn(value)) { return false; }
		fnToStr.call(value);
		return true;
	} catch (e) {
		return false;
	}
};
var toStr = Object.prototype.toString;
var fnClass = '[object Function]';
var genClass = '[object GeneratorFunction]';
var hasToStringTag = typeof Symbol === 'function' && typeof Symbol.toStringTag === 'symbol';

module.exports = function isCallable(value) {
	if (!value) { return false; }
	if (typeof value !== 'function' && typeof value !== 'object') { return false; }
	if (hasToStringTag) { return tryFunctionObject(value); }
	if (isES6ClassFn(value)) { return false; }
	var strClass = toStr.call(value);
	return strClass === fnClass || strClass === genClass;
};

},{}],63:[function(require,module,exports){
'use strict';

var implementation = require('./implementation');

var zeroWidthSpace = '\u200b';

module.exports = function getPolyfill() {
	if (String.prototype.trim && zeroWidthSpace.trim() === zeroWidthSpace) {
		return String.prototype.trim;
	}
	return implementation;
};

},{"./implementation":50}],64:[function(require,module,exports){
'use strict';

var define = require('define-properties');
var getPolyfill = require('./polyfill');

module.exports = function shimStringTrim() {
	var polyfill = getPolyfill();
	define(String.prototype, { trim: polyfill }, { trim: function () { return String.prototype.trim !== polyfill; } });
	return polyfill;
};

},{"./polyfill":63,"define-properties":52}],65:[function(require,module,exports){
(function (process){
var Stream = require('stream')

// through
//
// a stream that does nothing but re-emit the input.
// useful for aggregating a series of changing but not ending streams into one stream)

exports = module.exports = through
through.through = through

//create a readable writable stream.

function through (write, end, opts) {
  write = write || function (data) { this.queue(data) }
  end = end || function () { this.queue(null) }

  var ended = false, destroyed = false, buffer = [], _ended = false
  var stream = new Stream()
  stream.readable = stream.writable = true
  stream.paused = false

//  stream.autoPause   = !(opts && opts.autoPause   === false)
  stream.autoDestroy = !(opts && opts.autoDestroy === false)

  stream.write = function (data) {
    write.call(this, data)
    return !stream.paused
  }

  function drain() {
    while(buffer.length && !stream.paused) {
      var data = buffer.shift()
      if(null === data)
        return stream.emit('end')
      else
        stream.emit('data', data)
    }
  }

  stream.queue = stream.push = function (data) {
//    console.error(ended)
    if(_ended) return stream
    if(data === null) _ended = true
    buffer.push(data)
    drain()
    return stream
  }

  //this will be registered as the first 'end' listener
  //must call destroy next tick, to make sure we're after any
  //stream piped from here.
  //this is only a problem if end is not emitted synchronously.
  //a nicer way to do this is to make sure this is the last listener for 'end'

  stream.on('end', function () {
    stream.readable = false
    if(!stream.writable && stream.autoDestroy)
      process.nextTick(function () {
        stream.destroy()
      })
  })

  function _end () {
    stream.writable = false
    end.call(stream)
    if(!stream.readable && stream.autoDestroy)
      stream.destroy()
  }

  stream.end = function (data) {
    if(ended) return
    ended = true
    if(arguments.length) stream.write(data)
    _end() // will emit or queue
    return stream
  }

  stream.destroy = function () {
    if(destroyed) return
    destroyed = true
    ended = true
    buffer.length = 0
    stream.writable = stream.readable = false
    stream.emit('close')
    return stream
  }

  stream.pause = function () {
    if(stream.paused) return
    stream.paused = true
    return stream
  }

  stream.resume = function () {
    if(stream.paused) {
      stream.paused = false
      stream.emit('resume')
    }
    drain()
    //may have become paused again,
    //as drain emits 'data'.
    if(!stream.paused)
      stream.emit('drain')
    return stream
  }
  return stream
}


}).call(this,require('_process'))

},{"_process":77,"stream":91}],66:[function(require,module,exports){

},{}],67:[function(require,module,exports){
arguments[4][66][0].apply(exports,arguments)
},{"dup":66}],68:[function(require,module,exports){
(function (global){
/*!
 * The buffer module from node.js, for the browser.
 *
 * @author   Feross Aboukhadijeh <feross@feross.org> <http://feross.org>
 * @license  MIT
 */
/* eslint-disable no-proto */

'use strict'

var base64 = require('base64-js')
var ieee754 = require('ieee754')
var isArray = require('isarray')

exports.Buffer = Buffer
exports.SlowBuffer = SlowBuffer
exports.INSPECT_MAX_BYTES = 50
Buffer.poolSize = 8192 // not used by this implementation

var rootParent = {}

/**
 * If `Buffer.TYPED_ARRAY_SUPPORT`:
 *   === true    Use Uint8Array implementation (fastest)
 *   === false   Use Object implementation (most compatible, even IE6)
 *
 * Browsers that support typed arrays are IE 10+, Firefox 4+, Chrome 7+, Safari 5.1+,
 * Opera 11.6+, iOS 4.2+.
 *
 * Due to various browser bugs, sometimes the Object implementation will be used even
 * when the browser supports typed arrays.
 *
 * Note:
 *
 *   - Firefox 4-29 lacks support for adding new properties to `Uint8Array` instances,
 *     See: https://bugzilla.mozilla.org/show_bug.cgi?id=695438.
 *
 *   - Chrome 9-10 is missing the `TypedArray.prototype.subarray` function.
 *
 *   - IE10 has a broken `TypedArray.prototype.subarray` function which returns arrays of
 *     incorrect length in some situations.

 * We detect these buggy browsers and set `Buffer.TYPED_ARRAY_SUPPORT` to `false` so they
 * get the Object implementation, which is slower but behaves correctly.
 */
Buffer.TYPED_ARRAY_SUPPORT = global.TYPED_ARRAY_SUPPORT !== undefined
  ? global.TYPED_ARRAY_SUPPORT
  : typedArraySupport()

function typedArraySupport () {
  try {
    var arr = new Uint8Array(1)
    arr.foo = function () { return 42 }
    return arr.foo() === 42 && // typed array instances can be augmented
        typeof arr.subarray === 'function' && // chrome 9-10 lack `subarray`
        arr.subarray(1, 1).byteLength === 0 // ie10 has broken `subarray`
  } catch (e) {
    return false
  }
}

function kMaxLength () {
  return Buffer.TYPED_ARRAY_SUPPORT
    ? 0x7fffffff
    : 0x3fffffff
}

/**
 * The Buffer constructor returns instances of `Uint8Array` that have their
 * prototype changed to `Buffer.prototype`. Furthermore, `Buffer` is a subclass of
 * `Uint8Array`, so the returned instances will have all the node `Buffer` methods
 * and the `Uint8Array` methods. Square bracket notation works as expected -- it
 * returns a single octet.
 *
 * The `Uint8Array` prototype remains unmodified.
 */
function Buffer (arg) {
  if (!(this instanceof Buffer)) {
    // Avoid going through an ArgumentsAdaptorTrampoline in the common case.
    if (arguments.length > 1) return new Buffer(arg, arguments[1])
    return new Buffer(arg)
  }

  if (!Buffer.TYPED_ARRAY_SUPPORT) {
    this.length = 0
    this.parent = undefined
  }

  // Common case.
  if (typeof arg === 'number') {
    return fromNumber(this, arg)
  }

  // Slightly less common case.
  if (typeof arg === 'string') {
    return fromString(this, arg, arguments.length > 1 ? arguments[1] : 'utf8')
  }

  // Unusual.
  return fromObject(this, arg)
}

// TODO: Legacy, not needed anymore. Remove in next major version.
Buffer._augment = function (arr) {
  arr.__proto__ = Buffer.prototype
  return arr
}

function fromNumber (that, length) {
  that = allocate(that, length < 0 ? 0 : checked(length) | 0)
  if (!Buffer.TYPED_ARRAY_SUPPORT) {
    for (var i = 0; i < length; i++) {
      that[i] = 0
    }
  }
  return that
}

function fromString (that, string, encoding) {
  if (typeof encoding !== 'string' || encoding === '') encoding = 'utf8'

  // Assumption: byteLength() return value is always < kMaxLength.
  var length = byteLength(string, encoding) | 0
  that = allocate(that, length)

  that.write(string, encoding)
  return that
}

function fromObject (that, object) {
  if (Buffer.isBuffer(object)) return fromBuffer(that, object)

  if (isArray(object)) return fromArray(that, object)

  if (object == null) {
    throw new TypeError('must start with number, buffer, array or string')
  }

  if (typeof ArrayBuffer !== 'undefined') {
    if (object.buffer instanceof ArrayBuffer) {
      return fromTypedArray(that, object)
    }
    if (object instanceof ArrayBuffer) {
      return fromArrayBuffer(that, object)
    }
  }

  if (object.length) return fromArrayLike(that, object)

  return fromJsonObject(that, object)
}

function fromBuffer (that, buffer) {
  var length = checked(buffer.length) | 0
  that = allocate(that, length)
  buffer.copy(that, 0, 0, length)
  return that
}

function fromArray (that, array) {
  var length = checked(array.length) | 0
  that = allocate(that, length)
  for (var i = 0; i < length; i += 1) {
    that[i] = array[i] & 255
  }
  return that
}

// Duplicate of fromArray() to keep fromArray() monomorphic.
function fromTypedArray (that, array) {
  var length = checked(array.length) | 0
  that = allocate(that, length)
  // Truncating the elements is probably not what people expect from typed
  // arrays with BYTES_PER_ELEMENT > 1 but it's compatible with the behavior
  // of the old Buffer constructor.
  for (var i = 0; i < length; i += 1) {
    that[i] = array[i] & 255
  }
  return that
}

function fromArrayBuffer (that, array) {
  array.byteLength // this throws if `array` is not a valid ArrayBuffer

  if (Buffer.TYPED_ARRAY_SUPPORT) {
    // Return an augmented `Uint8Array` instance, for best performance
    that = new Uint8Array(array)
    that.__proto__ = Buffer.prototype
  } else {
    // Fallback: Return an object instance of the Buffer class
    that = fromTypedArray(that, new Uint8Array(array))
  }
  return that
}

function fromArrayLike (that, array) {
  var length = checked(array.length) | 0
  that = allocate(that, length)
  for (var i = 0; i < length; i += 1) {
    that[i] = array[i] & 255
  }
  return that
}

// Deserialize { type: 'Buffer', data: [1,2,3,...] } into a Buffer object.
// Returns a zero-length buffer for inputs that don't conform to the spec.
function fromJsonObject (that, object) {
  var array
  var length = 0

  if (object.type === 'Buffer' && isArray(object.data)) {
    array = object.data
    length = checked(array.length) | 0
  }
  that = allocate(that, length)

  for (var i = 0; i < length; i += 1) {
    that[i] = array[i] & 255
  }
  return that
}

if (Buffer.TYPED_ARRAY_SUPPORT) {
  Buffer.prototype.__proto__ = Uint8Array.prototype
  Buffer.__proto__ = Uint8Array
} else {
  // pre-set for values that may exist in the future
  Buffer.prototype.length = undefined
  Buffer.prototype.parent = undefined
}

function allocate (that, length) {
  if (Buffer.TYPED_ARRAY_SUPPORT) {
    // Return an augmented `Uint8Array` instance, for best performance
    that = new Uint8Array(length)
    that.__proto__ = Buffer.prototype
  } else {
    // Fallback: Return an object instance of the Buffer class
    that.length = length
  }

  var fromPool = length !== 0 && length <= Buffer.poolSize >>> 1
  if (fromPool) that.parent = rootParent

  return that
}

function checked (length) {
  // Note: cannot use `length < kMaxLength` here because that fails when
  // length is NaN (which is otherwise coerced to zero.)
  if (length >= kMaxLength()) {
    throw new RangeError('Attempt to allocate Buffer larger than maximum ' +
                         'size: 0x' + kMaxLength().toString(16) + ' bytes')
  }
  return length | 0
}

function SlowBuffer (subject, encoding) {
  if (!(this instanceof SlowBuffer)) return new SlowBuffer(subject, encoding)

  var buf = new Buffer(subject, encoding)
  delete buf.parent
  return buf
}

Buffer.isBuffer = function isBuffer (b) {
  return !!(b != null && b._isBuffer)
}

Buffer.compare = function compare (a, b) {
  if (!Buffer.isBuffer(a) || !Buffer.isBuffer(b)) {
    throw new TypeError('Arguments must be Buffers')
  }

  if (a === b) return 0

  var x = a.length
  var y = b.length

  var i = 0
  var len = Math.min(x, y)
  while (i < len) {
    if (a[i] !== b[i]) break

    ++i
  }

  if (i !== len) {
    x = a[i]
    y = b[i]
  }

  if (x < y) return -1
  if (y < x) return 1
  return 0
}

Buffer.isEncoding = function isEncoding (encoding) {
  switch (String(encoding).toLowerCase()) {
    case 'hex':
    case 'utf8':
    case 'utf-8':
    case 'ascii':
    case 'binary':
    case 'base64':
    case 'raw':
    case 'ucs2':
    case 'ucs-2':
    case 'utf16le':
    case 'utf-16le':
      return true
    default:
      return false
  }
}

Buffer.concat = function concat (list, length) {
  if (!isArray(list)) throw new TypeError('list argument must be an Array of Buffers.')

  if (list.length === 0) {
    return new Buffer(0)
  }

  var i
  if (length === undefined) {
    length = 0
    for (i = 0; i < list.length; i++) {
      length += list[i].length
    }
  }

  var buf = new Buffer(length)
  var pos = 0
  for (i = 0; i < list.length; i++) {
    var item = list[i]
    item.copy(buf, pos)
    pos += item.length
  }
  return buf
}

function byteLength (string, encoding) {
  if (typeof string !== 'string') string = '' + string

  var len = string.length
  if (len === 0) return 0

  // Use a for loop to avoid recursion
  var loweredCase = false
  for (;;) {
    switch (encoding) {
      case 'ascii':
      case 'binary':
      // Deprecated
      case 'raw':
      case 'raws':
        return len
      case 'utf8':
      case 'utf-8':
        return utf8ToBytes(string).length
      case 'ucs2':
      case 'ucs-2':
      case 'utf16le':
      case 'utf-16le':
        return len * 2
      case 'hex':
        return len >>> 1
      case 'base64':
        return base64ToBytes(string).length
      default:
        if (loweredCase) return utf8ToBytes(string).length // assume utf8
        encoding = ('' + encoding).toLowerCase()
        loweredCase = true
    }
  }
}
Buffer.byteLength = byteLength

function slowToString (encoding, start, end) {
  var loweredCase = false

  start = start | 0
  end = end === undefined || end === Infinity ? this.length : end | 0

  if (!encoding) encoding = 'utf8'
  if (start < 0) start = 0
  if (end > this.length) end = this.length
  if (end <= start) return ''

  while (true) {
    switch (encoding) {
      case 'hex':
        return hexSlice(this, start, end)

      case 'utf8':
      case 'utf-8':
        return utf8Slice(this, start, end)

      case 'ascii':
        return asciiSlice(this, start, end)

      case 'binary':
        return binarySlice(this, start, end)

      case 'base64':
        return base64Slice(this, start, end)

      case 'ucs2':
      case 'ucs-2':
      case 'utf16le':
      case 'utf-16le':
        return utf16leSlice(this, start, end)

      default:
        if (loweredCase) throw new TypeError('Unknown encoding: ' + encoding)
        encoding = (encoding + '').toLowerCase()
        loweredCase = true
    }
  }
}

// The property is used by `Buffer.isBuffer` and `is-buffer` (in Safari 5-7) to detect
// Buffer instances.
Buffer.prototype._isBuffer = true

Buffer.prototype.toString = function toString () {
  var length = this.length | 0
  if (length === 0) return ''
  if (arguments.length === 0) return utf8Slice(this, 0, length)
  return slowToString.apply(this, arguments)
}

Buffer.prototype.equals = function equals (b) {
  if (!Buffer.isBuffer(b)) throw new TypeError('Argument must be a Buffer')
  if (this === b) return true
  return Buffer.compare(this, b) === 0
}

Buffer.prototype.inspect = function inspect () {
  var str = ''
  var max = exports.INSPECT_MAX_BYTES
  if (this.length > 0) {
    str = this.toString('hex', 0, max).match(/.{2}/g).join(' ')
    if (this.length > max) str += ' ... '
  }
  return '<Buffer ' + str + '>'
}

Buffer.prototype.compare = function compare (b) {
  if (!Buffer.isBuffer(b)) throw new TypeError('Argument must be a Buffer')
  if (this === b) return 0
  return Buffer.compare(this, b)
}

Buffer.prototype.indexOf = function indexOf (val, byteOffset) {
  if (byteOffset > 0x7fffffff) byteOffset = 0x7fffffff
  else if (byteOffset < -0x80000000) byteOffset = -0x80000000
  byteOffset >>= 0

  if (this.length === 0) return -1
  if (byteOffset >= this.length) return -1

  // Negative offsets start from the end of the buffer
  if (byteOffset < 0) byteOffset = Math.max(this.length + byteOffset, 0)

  if (typeof val === 'string') {
    if (val.length === 0) return -1 // special case: looking for empty string always fails
    return String.prototype.indexOf.call(this, val, byteOffset)
  }
  if (Buffer.isBuffer(val)) {
    return arrayIndexOf(this, val, byteOffset)
  }
  if (typeof val === 'number') {
    if (Buffer.TYPED_ARRAY_SUPPORT && Uint8Array.prototype.indexOf === 'function') {
      return Uint8Array.prototype.indexOf.call(this, val, byteOffset)
    }
    return arrayIndexOf(this, [ val ], byteOffset)
  }

  function arrayIndexOf (arr, val, byteOffset) {
    var foundIndex = -1
    for (var i = 0; byteOffset + i < arr.length; i++) {
      if (arr[byteOffset + i] === val[foundIndex === -1 ? 0 : i - foundIndex]) {
        if (foundIndex === -1) foundIndex = i
        if (i - foundIndex + 1 === val.length) return byteOffset + foundIndex
      } else {
        foundIndex = -1
      }
    }
    return -1
  }

  throw new TypeError('val must be string, number or Buffer')
}

function hexWrite (buf, string, offset, length) {
  offset = Number(offset) || 0
  var remaining = buf.length - offset
  if (!length) {
    length = remaining
  } else {
    length = Number(length)
    if (length > remaining) {
      length = remaining
    }
  }

  // must be an even number of digits
  var strLen = string.length
  if (strLen % 2 !== 0) throw new Error('Invalid hex string')

  if (length > strLen / 2) {
    length = strLen / 2
  }
  for (var i = 0; i < length; i++) {
    var parsed = parseInt(string.substr(i * 2, 2), 16)
    if (isNaN(parsed)) throw new Error('Invalid hex string')
    buf[offset + i] = parsed
  }
  return i
}

function utf8Write (buf, string, offset, length) {
  return blitBuffer(utf8ToBytes(string, buf.length - offset), buf, offset, length)
}

function asciiWrite (buf, string, offset, length) {
  return blitBuffer(asciiToBytes(string), buf, offset, length)
}

function binaryWrite (buf, string, offset, length) {
  return asciiWrite(buf, string, offset, length)
}

function base64Write (buf, string, offset, length) {
  return blitBuffer(base64ToBytes(string), buf, offset, length)
}

function ucs2Write (buf, string, offset, length) {
  return blitBuffer(utf16leToBytes(string, buf.length - offset), buf, offset, length)
}

Buffer.prototype.write = function write (string, offset, length, encoding) {
  // Buffer#write(string)
  if (offset === undefined) {
    encoding = 'utf8'
    length = this.length
    offset = 0
  // Buffer#write(string, encoding)
  } else if (length === undefined && typeof offset === 'string') {
    encoding = offset
    length = this.length
    offset = 0
  // Buffer#write(string, offset[, length][, encoding])
  } else if (isFinite(offset)) {
    offset = offset | 0
    if (isFinite(length)) {
      length = length | 0
      if (encoding === undefined) encoding = 'utf8'
    } else {
      encoding = length
      length = undefined
    }
  // legacy write(string, encoding, offset, length) - remove in v0.13
  } else {
    var swap = encoding
    encoding = offset
    offset = length | 0
    length = swap
  }

  var remaining = this.length - offset
  if (length === undefined || length > remaining) length = remaining

  if ((string.length > 0 && (length < 0 || offset < 0)) || offset > this.length) {
    throw new RangeError('attempt to write outside buffer bounds')
  }

  if (!encoding) encoding = 'utf8'

  var loweredCase = false
  for (;;) {
    switch (encoding) {
      case 'hex':
        return hexWrite(this, string, offset, length)

      case 'utf8':
      case 'utf-8':
        return utf8Write(this, string, offset, length)

      case 'ascii':
        return asciiWrite(this, string, offset, length)

      case 'binary':
        return binaryWrite(this, string, offset, length)

      case 'base64':
        // Warning: maxLength not taken into account in base64Write
        return base64Write(this, string, offset, length)

      case 'ucs2':
      case 'ucs-2':
      case 'utf16le':
      case 'utf-16le':
        return ucs2Write(this, string, offset, length)

      default:
        if (loweredCase) throw new TypeError('Unknown encoding: ' + encoding)
        encoding = ('' + encoding).toLowerCase()
        loweredCase = true
    }
  }
}

Buffer.prototype.toJSON = function toJSON () {
  return {
    type: 'Buffer',
    data: Array.prototype.slice.call(this._arr || this, 0)
  }
}

function base64Slice (buf, start, end) {
  if (start === 0 && end === buf.length) {
    return base64.fromByteArray(buf)
  } else {
    return base64.fromByteArray(buf.slice(start, end))
  }
}

function utf8Slice (buf, start, end) {
  end = Math.min(buf.length, end)
  var res = []

  var i = start
  while (i < end) {
    var firstByte = buf[i]
    var codePoint = null
    var bytesPerSequence = (firstByte > 0xEF) ? 4
      : (firstByte > 0xDF) ? 3
      : (firstByte > 0xBF) ? 2
      : 1

    if (i + bytesPerSequence <= end) {
      var secondByte, thirdByte, fourthByte, tempCodePoint

      switch (bytesPerSequence) {
        case 1:
          if (firstByte < 0x80) {
            codePoint = firstByte
          }
          break
        case 2:
          secondByte = buf[i + 1]
          if ((secondByte & 0xC0) === 0x80) {
            tempCodePoint = (firstByte & 0x1F) << 0x6 | (secondByte & 0x3F)
            if (tempCodePoint > 0x7F) {
              codePoint = tempCodePoint
            }
          }
          break
        case 3:
          secondByte = buf[i + 1]
          thirdByte = buf[i + 2]
          if ((secondByte & 0xC0) === 0x80 && (thirdByte & 0xC0) === 0x80) {
            tempCodePoint = (firstByte & 0xF) << 0xC | (secondByte & 0x3F) << 0x6 | (thirdByte & 0x3F)
            if (tempCodePoint > 0x7FF && (tempCodePoint < 0xD800 || tempCodePoint > 0xDFFF)) {
              codePoint = tempCodePoint
            }
          }
          break
        case 4:
          secondByte = buf[i + 1]
          thirdByte = buf[i + 2]
          fourthByte = buf[i + 3]
          if ((secondByte & 0xC0) === 0x80 && (thirdByte & 0xC0) === 0x80 && (fourthByte & 0xC0) === 0x80) {
            tempCodePoint = (firstByte & 0xF) << 0x12 | (secondByte & 0x3F) << 0xC | (thirdByte & 0x3F) << 0x6 | (fourthByte & 0x3F)
            if (tempCodePoint > 0xFFFF && tempCodePoint < 0x110000) {
              codePoint = tempCodePoint
            }
          }
      }
    }

    if (codePoint === null) {
      // we did not generate a valid codePoint so insert a
      // replacement char (U+FFFD) and advance only 1 byte
      codePoint = 0xFFFD
      bytesPerSequence = 1
    } else if (codePoint > 0xFFFF) {
      // encode to utf16 (surrogate pair dance)
      codePoint -= 0x10000
      res.push(codePoint >>> 10 & 0x3FF | 0xD800)
      codePoint = 0xDC00 | codePoint & 0x3FF
    }

    res.push(codePoint)
    i += bytesPerSequence
  }

  return decodeCodePointsArray(res)
}

// Based on http://stackoverflow.com/a/22747272/680742, the browser with
// the lowest limit is Chrome, with 0x10000 args.
// We go 1 magnitude less, for safety
var MAX_ARGUMENTS_LENGTH = 0x1000

function decodeCodePointsArray (codePoints) {
  var len = codePoints.length
  if (len <= MAX_ARGUMENTS_LENGTH) {
    return String.fromCharCode.apply(String, codePoints) // avoid extra slice()
  }

  // Decode in chunks to avoid "call stack size exceeded".
  var res = ''
  var i = 0
  while (i < len) {
    res += String.fromCharCode.apply(
      String,
      codePoints.slice(i, i += MAX_ARGUMENTS_LENGTH)
    )
  }
  return res
}

function asciiSlice (buf, start, end) {
  var ret = ''
  end = Math.min(buf.length, end)

  for (var i = start; i < end; i++) {
    ret += String.fromCharCode(buf[i] & 0x7F)
  }
  return ret
}

function binarySlice (buf, start, end) {
  var ret = ''
  end = Math.min(buf.length, end)

  for (var i = start; i < end; i++) {
    ret += String.fromCharCode(buf[i])
  }
  return ret
}

function hexSlice (buf, start, end) {
  var len = buf.length

  if (!start || start < 0) start = 0
  if (!end || end < 0 || end > len) end = len

  var out = ''
  for (var i = start; i < end; i++) {
    out += toHex(buf[i])
  }
  return out
}

function utf16leSlice (buf, start, end) {
  var bytes = buf.slice(start, end)
  var res = ''
  for (var i = 0; i < bytes.length; i += 2) {
    res += String.fromCharCode(bytes[i] + bytes[i + 1] * 256)
  }
  return res
}

Buffer.prototype.slice = function slice (start, end) {
  var len = this.length
  start = ~~start
  end = end === undefined ? len : ~~end

  if (start < 0) {
    start += len
    if (start < 0) start = 0
  } else if (start > len) {
    start = len
  }

  if (end < 0) {
    end += len
    if (end < 0) end = 0
  } else if (end > len) {
    end = len
  }

  if (end < start) end = start

  var newBuf
  if (Buffer.TYPED_ARRAY_SUPPORT) {
    newBuf = this.subarray(start, end)
    newBuf.__proto__ = Buffer.prototype
  } else {
    var sliceLen = end - start
    newBuf = new Buffer(sliceLen, undefined)
    for (var i = 0; i < sliceLen; i++) {
      newBuf[i] = this[i + start]
    }
  }

  if (newBuf.length) newBuf.parent = this.parent || this

  return newBuf
}

/*
 * Need to make sure that buffer isn't trying to write out of bounds.
 */
function checkOffset (offset, ext, length) {
  if ((offset % 1) !== 0 || offset < 0) throw new RangeError('offset is not uint')
  if (offset + ext > length) throw new RangeError('Trying to access beyond buffer length')
}

Buffer.prototype.readUIntLE = function readUIntLE (offset, byteLength, noAssert) {
  offset = offset | 0
  byteLength = byteLength | 0
  if (!noAssert) checkOffset(offset, byteLength, this.length)

  var val = this[offset]
  var mul = 1
  var i = 0
  while (++i < byteLength && (mul *= 0x100)) {
    val += this[offset + i] * mul
  }

  return val
}

Buffer.prototype.readUIntBE = function readUIntBE (offset, byteLength, noAssert) {
  offset = offset | 0
  byteLength = byteLength | 0
  if (!noAssert) {
    checkOffset(offset, byteLength, this.length)
  }

  var val = this[offset + --byteLength]
  var mul = 1
  while (byteLength > 0 && (mul *= 0x100)) {
    val += this[offset + --byteLength] * mul
  }

  return val
}

Buffer.prototype.readUInt8 = function readUInt8 (offset, noAssert) {
  if (!noAssert) checkOffset(offset, 1, this.length)
  return this[offset]
}

Buffer.prototype.readUInt16LE = function readUInt16LE (offset, noAssert) {
  if (!noAssert) checkOffset(offset, 2, this.length)
  return this[offset] | (this[offset + 1] << 8)
}

Buffer.prototype.readUInt16BE = function readUInt16BE (offset, noAssert) {
  if (!noAssert) checkOffset(offset, 2, this.length)
  return (this[offset] << 8) | this[offset + 1]
}

Buffer.prototype.readUInt32LE = function readUInt32LE (offset, noAssert) {
  if (!noAssert) checkOffset(offset, 4, this.length)

  return ((this[offset]) |
      (this[offset + 1] << 8) |
      (this[offset + 2] << 16)) +
      (this[offset + 3] * 0x1000000)
}

Buffer.prototype.readUInt32BE = function readUInt32BE (offset, noAssert) {
  if (!noAssert) checkOffset(offset, 4, this.length)

  return (this[offset] * 0x1000000) +
    ((this[offset + 1] << 16) |
    (this[offset + 2] << 8) |
    this[offset + 3])
}

Buffer.prototype.readIntLE = function readIntLE (offset, byteLength, noAssert) {
  offset = offset | 0
  byteLength = byteLength | 0
  if (!noAssert) checkOffset(offset, byteLength, this.length)

  var val = this[offset]
  var mul = 1
  var i = 0
  while (++i < byteLength && (mul *= 0x100)) {
    val += this[offset + i] * mul
  }
  mul *= 0x80

  if (val >= mul) val -= Math.pow(2, 8 * byteLength)

  return val
}

Buffer.prototype.readIntBE = function readIntBE (offset, byteLength, noAssert) {
  offset = offset | 0
  byteLength = byteLength | 0
  if (!noAssert) checkOffset(offset, byteLength, this.length)

  var i = byteLength
  var mul = 1
  var val = this[offset + --i]
  while (i > 0 && (mul *= 0x100)) {
    val += this[offset + --i] * mul
  }
  mul *= 0x80

  if (val >= mul) val -= Math.pow(2, 8 * byteLength)

  return val
}

Buffer.prototype.readInt8 = function readInt8 (offset, noAssert) {
  if (!noAssert) checkOffset(offset, 1, this.length)
  if (!(this[offset] & 0x80)) return (this[offset])
  return ((0xff - this[offset] + 1) * -1)
}

Buffer.prototype.readInt16LE = function readInt16LE (offset, noAssert) {
  if (!noAssert) checkOffset(offset, 2, this.length)
  var val = this[offset] | (this[offset + 1] << 8)
  return (val & 0x8000) ? val | 0xFFFF0000 : val
}

Buffer.prototype.readInt16BE = function readInt16BE (offset, noAssert) {
  if (!noAssert) checkOffset(offset, 2, this.length)
  var val = this[offset + 1] | (this[offset] << 8)
  return (val & 0x8000) ? val | 0xFFFF0000 : val
}

Buffer.prototype.readInt32LE = function readInt32LE (offset, noAssert) {
  if (!noAssert) checkOffset(offset, 4, this.length)

  return (this[offset]) |
    (this[offset + 1] << 8) |
    (this[offset + 2] << 16) |
    (this[offset + 3] << 24)
}

Buffer.prototype.readInt32BE = function readInt32BE (offset, noAssert) {
  if (!noAssert) checkOffset(offset, 4, this.length)

  return (this[offset] << 24) |
    (this[offset + 1] << 16) |
    (this[offset + 2] << 8) |
    (this[offset + 3])
}

Buffer.prototype.readFloatLE = function readFloatLE (offset, noAssert) {
  if (!noAssert) checkOffset(offset, 4, this.length)
  return ieee754.read(this, offset, true, 23, 4)
}

Buffer.prototype.readFloatBE = function readFloatBE (offset, noAssert) {
  if (!noAssert) checkOffset(offset, 4, this.length)
  return ieee754.read(this, offset, false, 23, 4)
}

Buffer.prototype.readDoubleLE = function readDoubleLE (offset, noAssert) {
  if (!noAssert) checkOffset(offset, 8, this.length)
  return ieee754.read(this, offset, true, 52, 8)
}

Buffer.prototype.readDoubleBE = function readDoubleBE (offset, noAssert) {
  if (!noAssert) checkOffset(offset, 8, this.length)
  return ieee754.read(this, offset, false, 52, 8)
}

function checkInt (buf, value, offset, ext, max, min) {
  if (!Buffer.isBuffer(buf)) throw new TypeError('buffer must be a Buffer instance')
  if (value > max || value < min) throw new RangeError('value is out of bounds')
  if (offset + ext > buf.length) throw new RangeError('index out of range')
}

Buffer.prototype.writeUIntLE = function writeUIntLE (value, offset, byteLength, noAssert) {
  value = +value
  offset = offset | 0
  byteLength = byteLength | 0
  if (!noAssert) checkInt(this, value, offset, byteLength, Math.pow(2, 8 * byteLength), 0)

  var mul = 1
  var i = 0
  this[offset] = value & 0xFF
  while (++i < byteLength && (mul *= 0x100)) {
    this[offset + i] = (value / mul) & 0xFF
  }

  return offset + byteLength
}

Buffer.prototype.writeUIntBE = function writeUIntBE (value, offset, byteLength, noAssert) {
  value = +value
  offset = offset | 0
  byteLength = byteLength | 0
  if (!noAssert) checkInt(this, value, offset, byteLength, Math.pow(2, 8 * byteLength), 0)

  var i = byteLength - 1
  var mul = 1
  this[offset + i] = value & 0xFF
  while (--i >= 0 && (mul *= 0x100)) {
    this[offset + i] = (value / mul) & 0xFF
  }

  return offset + byteLength
}

Buffer.prototype.writeUInt8 = function writeUInt8 (value, offset, noAssert) {
  value = +value
  offset = offset | 0
  if (!noAssert) checkInt(this, value, offset, 1, 0xff, 0)
  if (!Buffer.TYPED_ARRAY_SUPPORT) value = Math.floor(value)
  this[offset] = (value & 0xff)
  return offset + 1
}

function objectWriteUInt16 (buf, value, offset, littleEndian) {
  if (value < 0) value = 0xffff + value + 1
  for (var i = 0, j = Math.min(buf.length - offset, 2); i < j; i++) {
    buf[offset + i] = (value & (0xff << (8 * (littleEndian ? i : 1 - i)))) >>>
      (littleEndian ? i : 1 - i) * 8
  }
}

Buffer.prototype.writeUInt16LE = function writeUInt16LE (value, offset, noAssert) {
  value = +value
  offset = offset | 0
  if (!noAssert) checkInt(this, value, offset, 2, 0xffff, 0)
  if (Buffer.TYPED_ARRAY_SUPPORT) {
    this[offset] = (value & 0xff)
    this[offset + 1] = (value >>> 8)
  } else {
    objectWriteUInt16(this, value, offset, true)
  }
  return offset + 2
}

Buffer.prototype.writeUInt16BE = function writeUInt16BE (value, offset, noAssert) {
  value = +value
  offset = offset | 0
  if (!noAssert) checkInt(this, value, offset, 2, 0xffff, 0)
  if (Buffer.TYPED_ARRAY_SUPPORT) {
    this[offset] = (value >>> 8)
    this[offset + 1] = (value & 0xff)
  } else {
    objectWriteUInt16(this, value, offset, false)
  }
  return offset + 2
}

function objectWriteUInt32 (buf, value, offset, littleEndian) {
  if (value < 0) value = 0xffffffff + value + 1
  for (var i = 0, j = Math.min(buf.length - offset, 4); i < j; i++) {
    buf[offset + i] = (value >>> (littleEndian ? i : 3 - i) * 8) & 0xff
  }
}

Buffer.prototype.writeUInt32LE = function writeUInt32LE (value, offset, noAssert) {
  value = +value
  offset = offset | 0
  if (!noAssert) checkInt(this, value, offset, 4, 0xffffffff, 0)
  if (Buffer.TYPED_ARRAY_SUPPORT) {
    this[offset + 3] = (value >>> 24)
    this[offset + 2] = (value >>> 16)
    this[offset + 1] = (value >>> 8)
    this[offset] = (value & 0xff)
  } else {
    objectWriteUInt32(this, value, offset, true)
  }
  return offset + 4
}

Buffer.prototype.writeUInt32BE = function writeUInt32BE (value, offset, noAssert) {
  value = +value
  offset = offset | 0
  if (!noAssert) checkInt(this, value, offset, 4, 0xffffffff, 0)
  if (Buffer.TYPED_ARRAY_SUPPORT) {
    this[offset] = (value >>> 24)
    this[offset + 1] = (value >>> 16)
    this[offset + 2] = (value >>> 8)
    this[offset + 3] = (value & 0xff)
  } else {
    objectWriteUInt32(this, value, offset, false)
  }
  return offset + 4
}

Buffer.prototype.writeIntLE = function writeIntLE (value, offset, byteLength, noAssert) {
  value = +value
  offset = offset | 0
  if (!noAssert) {
    var limit = Math.pow(2, 8 * byteLength - 1)

    checkInt(this, value, offset, byteLength, limit - 1, -limit)
  }

  var i = 0
  var mul = 1
  var sub = value < 0 ? 1 : 0
  this[offset] = value & 0xFF
  while (++i < byteLength && (mul *= 0x100)) {
    this[offset + i] = ((value / mul) >> 0) - sub & 0xFF
  }

  return offset + byteLength
}

Buffer.prototype.writeIntBE = function writeIntBE (value, offset, byteLength, noAssert) {
  value = +value
  offset = offset | 0
  if (!noAssert) {
    var limit = Math.pow(2, 8 * byteLength - 1)

    checkInt(this, value, offset, byteLength, limit - 1, -limit)
  }

  var i = byteLength - 1
  var mul = 1
  var sub = value < 0 ? 1 : 0
  this[offset + i] = value & 0xFF
  while (--i >= 0 && (mul *= 0x100)) {
    this[offset + i] = ((value / mul) >> 0) - sub & 0xFF
  }

  return offset + byteLength
}

Buffer.prototype.writeInt8 = function writeInt8 (value, offset, noAssert) {
  value = +value
  offset = offset | 0
  if (!noAssert) checkInt(this, value, offset, 1, 0x7f, -0x80)
  if (!Buffer.TYPED_ARRAY_SUPPORT) value = Math.floor(value)
  if (value < 0) value = 0xff + value + 1
  this[offset] = (value & 0xff)
  return offset + 1
}

Buffer.prototype.writeInt16LE = function writeInt16LE (value, offset, noAssert) {
  value = +value
  offset = offset | 0
  if (!noAssert) checkInt(this, value, offset, 2, 0x7fff, -0x8000)
  if (Buffer.TYPED_ARRAY_SUPPORT) {
    this[offset] = (value & 0xff)
    this[offset + 1] = (value >>> 8)
  } else {
    objectWriteUInt16(this, value, offset, true)
  }
  return offset + 2
}

Buffer.prototype.writeInt16BE = function writeInt16BE (value, offset, noAssert) {
  value = +value
  offset = offset | 0
  if (!noAssert) checkInt(this, value, offset, 2, 0x7fff, -0x8000)
  if (Buffer.TYPED_ARRAY_SUPPORT) {
    this[offset] = (value >>> 8)
    this[offset + 1] = (value & 0xff)
  } else {
    objectWriteUInt16(this, value, offset, false)
  }
  return offset + 2
}

Buffer.prototype.writeInt32LE = function writeInt32LE (value, offset, noAssert) {
  value = +value
  offset = offset | 0
  if (!noAssert) checkInt(this, value, offset, 4, 0x7fffffff, -0x80000000)
  if (Buffer.TYPED_ARRAY_SUPPORT) {
    this[offset] = (value & 0xff)
    this[offset + 1] = (value >>> 8)
    this[offset + 2] = (value >>> 16)
    this[offset + 3] = (value >>> 24)
  } else {
    objectWriteUInt32(this, value, offset, true)
  }
  return offset + 4
}

Buffer.prototype.writeInt32BE = function writeInt32BE (value, offset, noAssert) {
  value = +value
  offset = offset | 0
  if (!noAssert) checkInt(this, value, offset, 4, 0x7fffffff, -0x80000000)
  if (value < 0) value = 0xffffffff + value + 1
  if (Buffer.TYPED_ARRAY_SUPPORT) {
    this[offset] = (value >>> 24)
    this[offset + 1] = (value >>> 16)
    this[offset + 2] = (value >>> 8)
    this[offset + 3] = (value & 0xff)
  } else {
    objectWriteUInt32(this, value, offset, false)
  }
  return offset + 4
}

function checkIEEE754 (buf, value, offset, ext, max, min) {
  if (offset + ext > buf.length) throw new RangeError('index out of range')
  if (offset < 0) throw new RangeError('index out of range')
}

function writeFloat (buf, value, offset, littleEndian, noAssert) {
  if (!noAssert) {
    checkIEEE754(buf, value, offset, 4, 3.4028234663852886e+38, -3.4028234663852886e+38)
  }
  ieee754.write(buf, value, offset, littleEndian, 23, 4)
  return offset + 4
}

Buffer.prototype.writeFloatLE = function writeFloatLE (value, offset, noAssert) {
  return writeFloat(this, value, offset, true, noAssert)
}

Buffer.prototype.writeFloatBE = function writeFloatBE (value, offset, noAssert) {
  return writeFloat(this, value, offset, false, noAssert)
}

function writeDouble (buf, value, offset, littleEndian, noAssert) {
  if (!noAssert) {
    checkIEEE754(buf, value, offset, 8, 1.7976931348623157E+308, -1.7976931348623157E+308)
  }
  ieee754.write(buf, value, offset, littleEndian, 52, 8)
  return offset + 8
}

Buffer.prototype.writeDoubleLE = function writeDoubleLE (value, offset, noAssert) {
  return writeDouble(this, value, offset, true, noAssert)
}

Buffer.prototype.writeDoubleBE = function writeDoubleBE (value, offset, noAssert) {
  return writeDouble(this, value, offset, false, noAssert)
}

// copy(targetBuffer, targetStart=0, sourceStart=0, sourceEnd=buffer.length)
Buffer.prototype.copy = function copy (target, targetStart, start, end) {
  if (!start) start = 0
  if (!end && end !== 0) end = this.length
  if (targetStart >= target.length) targetStart = target.length
  if (!targetStart) targetStart = 0
  if (end > 0 && end < start) end = start

  // Copy 0 bytes; we're done
  if (end === start) return 0
  if (target.length === 0 || this.length === 0) return 0

  // Fatal error conditions
  if (targetStart < 0) {
    throw new RangeError('targetStart out of bounds')
  }
  if (start < 0 || start >= this.length) throw new RangeError('sourceStart out of bounds')
  if (end < 0) throw new RangeError('sourceEnd out of bounds')

  // Are we oob?
  if (end > this.length) end = this.length
  if (target.length - targetStart < end - start) {
    end = target.length - targetStart + start
  }

  var len = end - start
  var i

  if (this === target && start < targetStart && targetStart < end) {
    // descending copy from end
    for (i = len - 1; i >= 0; i--) {
      target[i + targetStart] = this[i + start]
    }
  } else if (len < 1000 || !Buffer.TYPED_ARRAY_SUPPORT) {
    // ascending copy from start
    for (i = 0; i < len; i++) {
      target[i + targetStart] = this[i + start]
    }
  } else {
    Uint8Array.prototype.set.call(
      target,
      this.subarray(start, start + len),
      targetStart
    )
  }

  return len
}

// fill(value, start=0, end=buffer.length)
Buffer.prototype.fill = function fill (value, start, end) {
  if (!value) value = 0
  if (!start) start = 0
  if (!end) end = this.length

  if (end < start) throw new RangeError('end < start')

  // Fill 0 bytes; we're done
  if (end === start) return
  if (this.length === 0) return

  if (start < 0 || start >= this.length) throw new RangeError('start out of bounds')
  if (end < 0 || end > this.length) throw new RangeError('end out of bounds')

  var i
  if (typeof value === 'number') {
    for (i = start; i < end; i++) {
      this[i] = value
    }
  } else {
    var bytes = utf8ToBytes(value.toString())
    var len = bytes.length
    for (i = start; i < end; i++) {
      this[i] = bytes[i % len]
    }
  }

  return this
}

// HELPER FUNCTIONS
// ================

var INVALID_BASE64_RE = /[^+\/0-9A-Za-z-_]/g

function base64clean (str) {
  // Node strips out invalid characters like \n and \t from the string, base64-js does not
  str = stringtrim(str).replace(INVALID_BASE64_RE, '')
  // Node converts strings with length < 2 to ''
  if (str.length < 2) return ''
  // Node allows for non-padded base64 strings (missing trailing ===), base64-js does not
  while (str.length % 4 !== 0) {
    str = str + '='
  }
  return str
}

function stringtrim (str) {
  if (str.trim) return str.trim()
  return str.replace(/^\s+|\s+$/g, '')
}

function toHex (n) {
  if (n < 16) return '0' + n.toString(16)
  return n.toString(16)
}

function utf8ToBytes (string, units) {
  units = units || Infinity
  var codePoint
  var length = string.length
  var leadSurrogate = null
  var bytes = []

  for (var i = 0; i < length; i++) {
    codePoint = string.charCodeAt(i)

    // is surrogate component
    if (codePoint > 0xD7FF && codePoint < 0xE000) {
      // last char was a lead
      if (!leadSurrogate) {
        // no lead yet
        if (codePoint > 0xDBFF) {
          // unexpected trail
          if ((units -= 3) > -1) bytes.push(0xEF, 0xBF, 0xBD)
          continue
        } else if (i + 1 === length) {
          // unpaired lead
          if ((units -= 3) > -1) bytes.push(0xEF, 0xBF, 0xBD)
          continue
        }

        // valid lead
        leadSurrogate = codePoint

        continue
      }

      // 2 leads in a row
      if (codePoint < 0xDC00) {
        if ((units -= 3) > -1) bytes.push(0xEF, 0xBF, 0xBD)
        leadSurrogate = codePoint
        continue
      }

      // valid surrogate pair
      codePoint = (leadSurrogate - 0xD800 << 10 | codePoint - 0xDC00) + 0x10000
    } else if (leadSurrogate) {
      // valid bmp char, but last char was a lead
      if ((units -= 3) > -1) bytes.push(0xEF, 0xBF, 0xBD)
    }

    leadSurrogate = null

    // encode utf8
    if (codePoint < 0x80) {
      if ((units -= 1) < 0) break
      bytes.push(codePoint)
    } else if (codePoint < 0x800) {
      if ((units -= 2) < 0) break
      bytes.push(
        codePoint >> 0x6 | 0xC0,
        codePoint & 0x3F | 0x80
      )
    } else if (codePoint < 0x10000) {
      if ((units -= 3) < 0) break
      bytes.push(
        codePoint >> 0xC | 0xE0,
        codePoint >> 0x6 & 0x3F | 0x80,
        codePoint & 0x3F | 0x80
      )
    } else if (codePoint < 0x110000) {
      if ((units -= 4) < 0) break
      bytes.push(
        codePoint >> 0x12 | 0xF0,
        codePoint >> 0xC & 0x3F | 0x80,
        codePoint >> 0x6 & 0x3F | 0x80,
        codePoint & 0x3F | 0x80
      )
    } else {
      throw new Error('Invalid code point')
    }
  }

  return bytes
}

function asciiToBytes (str) {
  var byteArray = []
  for (var i = 0; i < str.length; i++) {
    // Node's code seems to be doing this and not & 0x7F..
    byteArray.push(str.charCodeAt(i) & 0xFF)
  }
  return byteArray
}

function utf16leToBytes (str, units) {
  var c, hi, lo
  var byteArray = []
  for (var i = 0; i < str.length; i++) {
    if ((units -= 2) < 0) break

    c = str.charCodeAt(i)
    hi = c >> 8
    lo = c % 256
    byteArray.push(lo)
    byteArray.push(hi)
  }

  return byteArray
}

function base64ToBytes (str) {
  return base64.toByteArray(base64clean(str))
}

function blitBuffer (src, dst, offset, length) {
  for (var i = 0; i < length; i++) {
    if ((i + offset >= dst.length) || (i >= src.length)) break
    dst[i + offset] = src[i]
  }
  return i
}

}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})

},{"base64-js":69,"ieee754":70,"isarray":71}],69:[function(require,module,exports){
;(function (exports) {
  'use strict'

  var lookup = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'

  var Arr = (typeof Uint8Array !== 'undefined')
    ? Uint8Array
    : Array

  var PLUS = '+'.charCodeAt(0)
  var SLASH = '/'.charCodeAt(0)
  var NUMBER = '0'.charCodeAt(0)
  var LOWER = 'a'.charCodeAt(0)
  var UPPER = 'A'.charCodeAt(0)
  var PLUS_URL_SAFE = '-'.charCodeAt(0)
  var SLASH_URL_SAFE = '_'.charCodeAt(0)

  function decode (elt) {
    var code = elt.charCodeAt(0)
    if (code === PLUS || code === PLUS_URL_SAFE) return 62 // '+'
    if (code === SLASH || code === SLASH_URL_SAFE) return 63 // '/'
    if (code < NUMBER) return -1 // no match
    if (code < NUMBER + 10) return code - NUMBER + 26 + 26
    if (code < UPPER + 26) return code - UPPER
    if (code < LOWER + 26) return code - LOWER + 26
  }

  function b64ToByteArray (b64) {
    var i, j, l, tmp, placeHolders, arr

    if (b64.length % 4 > 0) {
      throw new Error('Invalid string. Length must be a multiple of 4')
    }

    // the number of equal signs (place holders)
    // if there are two placeholders, than the two characters before it
    // represent one byte
    // if there is only one, then the three characters before it represent 2 bytes
    // this is just a cheap hack to not do indexOf twice
    var len = b64.length
    placeHolders = b64.charAt(len - 2) === '=' ? 2 : b64.charAt(len - 1) === '=' ? 1 : 0

    // base64 is 4/3 + up to two characters of the original data
    arr = new Arr(b64.length * 3 / 4 - placeHolders)

    // if there are placeholders, only get up to the last complete 4 chars
    l = placeHolders > 0 ? b64.length - 4 : b64.length

    var L = 0

    function push (v) {
      arr[L++] = v
    }

    for (i = 0, j = 0; i < l; i += 4, j += 3) {
      tmp = (decode(b64.charAt(i)) << 18) | (decode(b64.charAt(i + 1)) << 12) | (decode(b64.charAt(i + 2)) << 6) | decode(b64.charAt(i + 3))
      push((tmp & 0xFF0000) >> 16)
      push((tmp & 0xFF00) >> 8)
      push(tmp & 0xFF)
    }

    if (placeHolders === 2) {
      tmp = (decode(b64.charAt(i)) << 2) | (decode(b64.charAt(i + 1)) >> 4)
      push(tmp & 0xFF)
    } else if (placeHolders === 1) {
      tmp = (decode(b64.charAt(i)) << 10) | (decode(b64.charAt(i + 1)) << 4) | (decode(b64.charAt(i + 2)) >> 2)
      push((tmp >> 8) & 0xFF)
      push(tmp & 0xFF)
    }

    return arr
  }

  function uint8ToBase64 (uint8) {
    var i
    var extraBytes = uint8.length % 3 // if we have 1 byte left, pad 2 bytes
    var output = ''
    var temp, length

    function encode (num) {
      return lookup.charAt(num)
    }

    function tripletToBase64 (num) {
      return encode(num >> 18 & 0x3F) + encode(num >> 12 & 0x3F) + encode(num >> 6 & 0x3F) + encode(num & 0x3F)
    }

    // go through the array every three bytes, we'll deal with trailing stuff later
    for (i = 0, length = uint8.length - extraBytes; i < length; i += 3) {
      temp = (uint8[i] << 16) + (uint8[i + 1] << 8) + (uint8[i + 2])
      output += tripletToBase64(temp)
    }

    // pad the end with zeros, but make sure to not forget the extra bytes
    switch (extraBytes) {
      case 1:
        temp = uint8[uint8.length - 1]
        output += encode(temp >> 2)
        output += encode((temp << 4) & 0x3F)
        output += '=='
        break
      case 2:
        temp = (uint8[uint8.length - 2] << 8) + (uint8[uint8.length - 1])
        output += encode(temp >> 10)
        output += encode((temp >> 4) & 0x3F)
        output += encode((temp << 2) & 0x3F)
        output += '='
        break
      default:
        break
    }

    return output
  }

  exports.toByteArray = b64ToByteArray
  exports.fromByteArray = uint8ToBase64
}(typeof exports === 'undefined' ? (this.base64js = {}) : exports))

},{}],70:[function(require,module,exports){
exports.read = function (buffer, offset, isLE, mLen, nBytes) {
  var e, m
  var eLen = nBytes * 8 - mLen - 1
  var eMax = (1 << eLen) - 1
  var eBias = eMax >> 1
  var nBits = -7
  var i = isLE ? (nBytes - 1) : 0
  var d = isLE ? -1 : 1
  var s = buffer[offset + i]

  i += d

  e = s & ((1 << (-nBits)) - 1)
  s >>= (-nBits)
  nBits += eLen
  for (; nBits > 0; e = e * 256 + buffer[offset + i], i += d, nBits -= 8) {}

  m = e & ((1 << (-nBits)) - 1)
  e >>= (-nBits)
  nBits += mLen
  for (; nBits > 0; m = m * 256 + buffer[offset + i], i += d, nBits -= 8) {}

  if (e === 0) {
    e = 1 - eBias
  } else if (e === eMax) {
    return m ? NaN : ((s ? -1 : 1) * Infinity)
  } else {
    m = m + Math.pow(2, mLen)
    e = e - eBias
  }
  return (s ? -1 : 1) * m * Math.pow(2, e - mLen)
}

exports.write = function (buffer, value, offset, isLE, mLen, nBytes) {
  var e, m, c
  var eLen = nBytes * 8 - mLen - 1
  var eMax = (1 << eLen) - 1
  var eBias = eMax >> 1
  var rt = (mLen === 23 ? Math.pow(2, -24) - Math.pow(2, -77) : 0)
  var i = isLE ? 0 : (nBytes - 1)
  var d = isLE ? 1 : -1
  var s = value < 0 || (value === 0 && 1 / value < 0) ? 1 : 0

  value = Math.abs(value)

  if (isNaN(value) || value === Infinity) {
    m = isNaN(value) ? 1 : 0
    e = eMax
  } else {
    e = Math.floor(Math.log(value) / Math.LN2)
    if (value * (c = Math.pow(2, -e)) < 1) {
      e--
      c *= 2
    }
    if (e + eBias >= 1) {
      value += rt / c
    } else {
      value += rt * Math.pow(2, 1 - eBias)
    }
    if (value * c >= 2) {
      e++
      c /= 2
    }

    if (e + eBias >= eMax) {
      m = 0
      e = eMax
    } else if (e + eBias >= 1) {
      m = (value * c - 1) * Math.pow(2, mLen)
      e = e + eBias
    } else {
      m = value * Math.pow(2, eBias - 1) * Math.pow(2, mLen)
      e = 0
    }
  }

  for (; mLen >= 8; buffer[offset + i] = m & 0xff, i += d, m /= 256, mLen -= 8) {}

  e = (e << mLen) | m
  eLen += mLen
  for (; eLen > 0; buffer[offset + i] = e & 0xff, i += d, e /= 256, eLen -= 8) {}

  buffer[offset + i - d] |= s * 128
}

},{}],71:[function(require,module,exports){
var toString = {}.toString;

module.exports = Array.isArray || function (arr) {
  return toString.call(arr) == '[object Array]';
};

},{}],72:[function(require,module,exports){
// Copyright Joyent, Inc. and other Node contributors.
//
// Permission is hereby granted, free of charge, to any person obtaining a
// copy of this software and associated documentation files (the
// "Software"), to deal in the Software without restriction, including
// without limitation the rights to use, copy, modify, merge, publish,
// distribute, sublicense, and/or sell copies of the Software, and to permit
// persons to whom the Software is furnished to do so, subject to the
// following conditions:
//
// The above copyright notice and this permission notice shall be included
// in all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
// OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
// MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN
// NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
// DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
// OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE
// USE OR OTHER DEALINGS IN THE SOFTWARE.

function EventEmitter() {
  this._events = this._events || {};
  this._maxListeners = this._maxListeners || undefined;
}
module.exports = EventEmitter;

// Backwards-compat with node 0.10.x
EventEmitter.EventEmitter = EventEmitter;

EventEmitter.prototype._events = undefined;
EventEmitter.prototype._maxListeners = undefined;

// By default EventEmitters will print a warning if more than 10 listeners are
// added to it. This is a useful default which helps finding memory leaks.
EventEmitter.defaultMaxListeners = 10;

// Obviously not all Emitters should be limited to 10. This function allows
// that to be increased. Set to zero for unlimited.
EventEmitter.prototype.setMaxListeners = function(n) {
  if (!isNumber(n) || n < 0 || isNaN(n))
    throw TypeError('n must be a positive number');
  this._maxListeners = n;
  return this;
};

EventEmitter.prototype.emit = function(type) {
  var er, handler, len, args, i, listeners;

  if (!this._events)
    this._events = {};

  // If there is no 'error' event listener then throw.
  if (type === 'error') {
    if (!this._events.error ||
        (isObject(this._events.error) && !this._events.error.length)) {
      er = arguments[1];
      if (er instanceof Error) {
        throw er; // Unhandled 'error' event
      }
      throw TypeError('Uncaught, unspecified "error" event.');
    }
  }

  handler = this._events[type];

  if (isUndefined(handler))
    return false;

  if (isFunction(handler)) {
    switch (arguments.length) {
      // fast cases
      case 1:
        handler.call(this);
        break;
      case 2:
        handler.call(this, arguments[1]);
        break;
      case 3:
        handler.call(this, arguments[1], arguments[2]);
        break;
      // slower
      default:
        args = Array.prototype.slice.call(arguments, 1);
        handler.apply(this, args);
    }
  } else if (isObject(handler)) {
    args = Array.prototype.slice.call(arguments, 1);
    listeners = handler.slice();
    len = listeners.length;
    for (i = 0; i < len; i++)
      listeners[i].apply(this, args);
  }

  return true;
};

EventEmitter.prototype.addListener = function(type, listener) {
  var m;

  if (!isFunction(listener))
    throw TypeError('listener must be a function');

  if (!this._events)
    this._events = {};

  // To avoid recursion in the case that type === "newListener"! Before
  // adding it to the listeners, first emit "newListener".
  if (this._events.newListener)
    this.emit('newListener', type,
              isFunction(listener.listener) ?
              listener.listener : listener);

  if (!this._events[type])
    // Optimize the case of one listener. Don't need the extra array object.
    this._events[type] = listener;
  else if (isObject(this._events[type]))
    // If we've already got an array, just append.
    this._events[type].push(listener);
  else
    // Adding the second element, need to change to array.
    this._events[type] = [this._events[type], listener];

  // Check for listener leak
  if (isObject(this._events[type]) && !this._events[type].warned) {
    if (!isUndefined(this._maxListeners)) {
      m = this._maxListeners;
    } else {
      m = EventEmitter.defaultMaxListeners;
    }

    if (m && m > 0 && this._events[type].length > m) {
      this._events[type].warned = true;
      console.error('(node) warning: possible EventEmitter memory ' +
                    'leak detected. %d listeners added. ' +
                    'Use emitter.setMaxListeners() to increase limit.',
                    this._events[type].length);
      if (typeof console.trace === 'function') {
        // not supported in IE 10
        console.trace();
      }
    }
  }

  return this;
};

EventEmitter.prototype.on = EventEmitter.prototype.addListener;

EventEmitter.prototype.once = function(type, listener) {
  if (!isFunction(listener))
    throw TypeError('listener must be a function');

  var fired = false;

  function g() {
    this.removeListener(type, g);

    if (!fired) {
      fired = true;
      listener.apply(this, arguments);
    }
  }

  g.listener = listener;
  this.on(type, g);

  return this;
};

// emits a 'removeListener' event iff the listener was removed
EventEmitter.prototype.removeListener = function(type, listener) {
  var list, position, length, i;

  if (!isFunction(listener))
    throw TypeError('listener must be a function');

  if (!this._events || !this._events[type])
    return this;

  list = this._events[type];
  length = list.length;
  position = -1;

  if (list === listener ||
      (isFunction(list.listener) && list.listener === listener)) {
    delete this._events[type];
    if (this._events.removeListener)
      this.emit('removeListener', type, listener);

  } else if (isObject(list)) {
    for (i = length; i-- > 0;) {
      if (list[i] === listener ||
          (list[i].listener && list[i].listener === listener)) {
        position = i;
        break;
      }
    }

    if (position < 0)
      return this;

    if (list.length === 1) {
      list.length = 0;
      delete this._events[type];
    } else {
      list.splice(position, 1);
    }

    if (this._events.removeListener)
      this.emit('removeListener', type, listener);
  }

  return this;
};

EventEmitter.prototype.removeAllListeners = function(type) {
  var key, listeners;

  if (!this._events)
    return this;

  // not listening for removeListener, no need to emit
  if (!this._events.removeListener) {
    if (arguments.length === 0)
      this._events = {};
    else if (this._events[type])
      delete this._events[type];
    return this;
  }

  // emit removeListener for all listeners on all events
  if (arguments.length === 0) {
    for (key in this._events) {
      if (key === 'removeListener') continue;
      this.removeAllListeners(key);
    }
    this.removeAllListeners('removeListener');
    this._events = {};
    return this;
  }

  listeners = this._events[type];

  if (isFunction(listeners)) {
    this.removeListener(type, listeners);
  } else if (listeners) {
    // LIFO order
    while (listeners.length)
      this.removeListener(type, listeners[listeners.length - 1]);
  }
  delete this._events[type];

  return this;
};

EventEmitter.prototype.listeners = function(type) {
  var ret;
  if (!this._events || !this._events[type])
    ret = [];
  else if (isFunction(this._events[type]))
    ret = [this._events[type]];
  else
    ret = this._events[type].slice();
  return ret;
};

EventEmitter.prototype.listenerCount = function(type) {
  if (this._events) {
    var evlistener = this._events[type];

    if (isFunction(evlistener))
      return 1;
    else if (evlistener)
      return evlistener.length;
  }
  return 0;
};

EventEmitter.listenerCount = function(emitter, type) {
  return emitter.listenerCount(type);
};

function isFunction(arg) {
  return typeof arg === 'function';
}

function isNumber(arg) {
  return typeof arg === 'number';
}

function isObject(arg) {
  return typeof arg === 'object' && arg !== null;
}

function isUndefined(arg) {
  return arg === void 0;
}

},{}],73:[function(require,module,exports){
arguments[4][47][0].apply(exports,arguments)
},{"dup":47}],74:[function(require,module,exports){
/**
 * Determine if an object is Buffer
 *
 * Author:   Feross Aboukhadijeh <feross@feross.org> <http://feross.org>
 * License:  MIT
 *
 * `npm install is-buffer`
 */

module.exports = function (obj) {
  return !!(obj != null &&
    (obj._isBuffer || // For Safari 5-7 (missing Object.prototype.constructor)
      (obj.constructor &&
      typeof obj.constructor.isBuffer === 'function' &&
      obj.constructor.isBuffer(obj))
    ))
}

},{}],75:[function(require,module,exports){
module.exports = Array.isArray || function (arr) {
  return Object.prototype.toString.call(arr) == '[object Array]';
};

},{}],76:[function(require,module,exports){
(function (process){
// Copyright Joyent, Inc. and other Node contributors.
//
// Permission is hereby granted, free of charge, to any person obtaining a
// copy of this software and associated documentation files (the
// "Software"), to deal in the Software without restriction, including
// without limitation the rights to use, copy, modify, merge, publish,
// distribute, sublicense, and/or sell copies of the Software, and to permit
// persons to whom the Software is furnished to do so, subject to the
// following conditions:
//
// The above copyright notice and this permission notice shall be included
// in all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
// OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
// MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN
// NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
// DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
// OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE
// USE OR OTHER DEALINGS IN THE SOFTWARE.

// resolves . and .. elements in a path array with directory names there
// must be no slashes, empty elements, or device names (c:\) in the array
// (so also no leading and trailing slashes - it does not distinguish
// relative and absolute paths)
function normalizeArray(parts, allowAboveRoot) {
  // if the path tries to go above the root, `up` ends up > 0
  var up = 0;
  for (var i = parts.length - 1; i >= 0; i--) {
    var last = parts[i];
    if (last === '.') {
      parts.splice(i, 1);
    } else if (last === '..') {
      parts.splice(i, 1);
      up++;
    } else if (up) {
      parts.splice(i, 1);
      up--;
    }
  }

  // if the path is allowed to go above the root, restore leading ..s
  if (allowAboveRoot) {
    for (; up--; up) {
      parts.unshift('..');
    }
  }

  return parts;
}

// Split a filename into [root, dir, basename, ext], unix version
// 'root' is just a slash, or nothing.
var splitPathRe =
    /^(\/?|)([\s\S]*?)((?:\.{1,2}|[^\/]+?|)(\.[^.\/]*|))(?:[\/]*)$/;
var splitPath = function(filename) {
  return splitPathRe.exec(filename).slice(1);
};

// path.resolve([from ...], to)
// posix version
exports.resolve = function() {
  var resolvedPath = '',
      resolvedAbsolute = false;

  for (var i = arguments.length - 1; i >= -1 && !resolvedAbsolute; i--) {
    var path = (i >= 0) ? arguments[i] : process.cwd();

    // Skip empty and invalid entries
    if (typeof path !== 'string') {
      throw new TypeError('Arguments to path.resolve must be strings');
    } else if (!path) {
      continue;
    }

    resolvedPath = path + '/' + resolvedPath;
    resolvedAbsolute = path.charAt(0) === '/';
  }

  // At this point the path should be resolved to a full absolute path, but
  // handle relative paths to be safe (might happen when process.cwd() fails)

  // Normalize the path
  resolvedPath = normalizeArray(filter(resolvedPath.split('/'), function(p) {
    return !!p;
  }), !resolvedAbsolute).join('/');

  return ((resolvedAbsolute ? '/' : '') + resolvedPath) || '.';
};

// path.normalize(path)
// posix version
exports.normalize = function(path) {
  var isAbsolute = exports.isAbsolute(path),
      trailingSlash = substr(path, -1) === '/';

  // Normalize the path
  path = normalizeArray(filter(path.split('/'), function(p) {
    return !!p;
  }), !isAbsolute).join('/');

  if (!path && !isAbsolute) {
    path = '.';
  }
  if (path && trailingSlash) {
    path += '/';
  }

  return (isAbsolute ? '/' : '') + path;
};

// posix version
exports.isAbsolute = function(path) {
  return path.charAt(0) === '/';
};

// posix version
exports.join = function() {
  var paths = Array.prototype.slice.call(arguments, 0);
  return exports.normalize(filter(paths, function(p, index) {
    if (typeof p !== 'string') {
      throw new TypeError('Arguments to path.join must be strings');
    }
    return p;
  }).join('/'));
};


// path.relative(from, to)
// posix version
exports.relative = function(from, to) {
  from = exports.resolve(from).substr(1);
  to = exports.resolve(to).substr(1);

  function trim(arr) {
    var start = 0;
    for (; start < arr.length; start++) {
      if (arr[start] !== '') break;
    }

    var end = arr.length - 1;
    for (; end >= 0; end--) {
      if (arr[end] !== '') break;
    }

    if (start > end) return [];
    return arr.slice(start, end - start + 1);
  }

  var fromParts = trim(from.split('/'));
  var toParts = trim(to.split('/'));

  var length = Math.min(fromParts.length, toParts.length);
  var samePartsLength = length;
  for (var i = 0; i < length; i++) {
    if (fromParts[i] !== toParts[i]) {
      samePartsLength = i;
      break;
    }
  }

  var outputParts = [];
  for (var i = samePartsLength; i < fromParts.length; i++) {
    outputParts.push('..');
  }

  outputParts = outputParts.concat(toParts.slice(samePartsLength));

  return outputParts.join('/');
};

exports.sep = '/';
exports.delimiter = ':';

exports.dirname = function(path) {
  var result = splitPath(path),
      root = result[0],
      dir = result[1];

  if (!root && !dir) {
    // No dirname whatsoever
    return '.';
  }

  if (dir) {
    // It has a dirname, strip trailing slash
    dir = dir.substr(0, dir.length - 1);
  }

  return root + dir;
};


exports.basename = function(path, ext) {
  var f = splitPath(path)[2];
  // TODO: make this comparison case-insensitive on windows?
  if (ext && f.substr(-1 * ext.length) === ext) {
    f = f.substr(0, f.length - ext.length);
  }
  return f;
};


exports.extname = function(path) {
  return splitPath(path)[3];
};

function filter (xs, f) {
    if (xs.filter) return xs.filter(f);
    var res = [];
    for (var i = 0; i < xs.length; i++) {
        if (f(xs[i], i, xs)) res.push(xs[i]);
    }
    return res;
}

// String.prototype.substr - negative index don't work in IE8
var substr = 'ab'.substr(-1) === 'b'
    ? function (str, start, len) { return str.substr(start, len) }
    : function (str, start, len) {
        if (start < 0) start = str.length + start;
        return str.substr(start, len);
    }
;

}).call(this,require('_process'))

},{"_process":77}],77:[function(require,module,exports){
// shim for using process in browser

var process = module.exports = {};
var queue = [];
var draining = false;
var currentQueue;
var queueIndex = -1;

function cleanUpNextTick() {
    draining = false;
    if (currentQueue.length) {
        queue = currentQueue.concat(queue);
    } else {
        queueIndex = -1;
    }
    if (queue.length) {
        drainQueue();
    }
}

function drainQueue() {
    if (draining) {
        return;
    }
    var timeout = setTimeout(cleanUpNextTick);
    draining = true;

    var len = queue.length;
    while(len) {
        currentQueue = queue;
        queue = [];
        while (++queueIndex < len) {
            if (currentQueue) {
                currentQueue[queueIndex].run();
            }
        }
        queueIndex = -1;
        len = queue.length;
    }
    currentQueue = null;
    draining = false;
    clearTimeout(timeout);
}

process.nextTick = function (fun) {
    var args = new Array(arguments.length - 1);
    if (arguments.length > 1) {
        for (var i = 1; i < arguments.length; i++) {
            args[i - 1] = arguments[i];
        }
    }
    queue.push(new Item(fun, args));
    if (queue.length === 1 && !draining) {
        setTimeout(drainQueue, 0);
    }
};

// v8 likes predictible objects
function Item(fun, array) {
    this.fun = fun;
    this.array = array;
}
Item.prototype.run = function () {
    this.fun.apply(null, this.array);
};
process.title = 'browser';
process.browser = true;
process.env = {};
process.argv = [];
process.version = ''; // empty string to avoid regexp issues
process.versions = {};

function noop() {}

process.on = noop;
process.addListener = noop;
process.once = noop;
process.off = noop;
process.removeListener = noop;
process.removeAllListeners = noop;
process.emit = noop;

process.binding = function (name) {
    throw new Error('process.binding is not supported');
};

process.cwd = function () { return '/' };
process.chdir = function (dir) {
    throw new Error('process.chdir is not supported');
};
process.umask = function() { return 0; };

},{}],78:[function(require,module,exports){
module.exports = require("./lib/_stream_duplex.js")

},{"./lib/_stream_duplex.js":79}],79:[function(require,module,exports){
// a duplex stream is just a stream that is both readable and writable.
// Since JS doesn't have multiple prototypal inheritance, this class
// prototypally inherits from Readable, and then parasitically from
// Writable.

'use strict';

/*<replacement>*/
var objectKeys = Object.keys || function (obj) {
  var keys = [];
  for (var key in obj) keys.push(key);
  return keys;
}
/*</replacement>*/


module.exports = Duplex;

/*<replacement>*/
var processNextTick = require('process-nextick-args');
/*</replacement>*/



/*<replacement>*/
var util = require('core-util-is');
util.inherits = require('inherits');
/*</replacement>*/

var Readable = require('./_stream_readable');
var Writable = require('./_stream_writable');

util.inherits(Duplex, Readable);

var keys = objectKeys(Writable.prototype);
for (var v = 0; v < keys.length; v++) {
  var method = keys[v];
  if (!Duplex.prototype[method])
    Duplex.prototype[method] = Writable.prototype[method];
}

function Duplex(options) {
  if (!(this instanceof Duplex))
    return new Duplex(options);

  Readable.call(this, options);
  Writable.call(this, options);

  if (options && options.readable === false)
    this.readable = false;

  if (options && options.writable === false)
    this.writable = false;

  this.allowHalfOpen = true;
  if (options && options.allowHalfOpen === false)
    this.allowHalfOpen = false;

  this.once('end', onend);
}

// the no-half-open enforcer
function onend() {
  // if we allow half-open state, or if the writable side ended,
  // then we're ok.
  if (this.allowHalfOpen || this._writableState.ended)
    return;

  // no more data can be written.
  // But allow more writes to happen in this tick.
  processNextTick(onEndNT, this);
}

function onEndNT(self) {
  self.end();
}

function forEach (xs, f) {
  for (var i = 0, l = xs.length; i < l; i++) {
    f(xs[i], i);
  }
}

},{"./_stream_readable":81,"./_stream_writable":83,"core-util-is":84,"inherits":73,"process-nextick-args":85}],80:[function(require,module,exports){
// a passthrough stream.
// basically just the most minimal sort of Transform stream.
// Every written chunk gets output as-is.

'use strict';

module.exports = PassThrough;

var Transform = require('./_stream_transform');

/*<replacement>*/
var util = require('core-util-is');
util.inherits = require('inherits');
/*</replacement>*/

util.inherits(PassThrough, Transform);

function PassThrough(options) {
  if (!(this instanceof PassThrough))
    return new PassThrough(options);

  Transform.call(this, options);
}

PassThrough.prototype._transform = function(chunk, encoding, cb) {
  cb(null, chunk);
};

},{"./_stream_transform":82,"core-util-is":84,"inherits":73}],81:[function(require,module,exports){
(function (process){
'use strict';

module.exports = Readable;

/*<replacement>*/
var processNextTick = require('process-nextick-args');
/*</replacement>*/


/*<replacement>*/
var isArray = require('isarray');
/*</replacement>*/


/*<replacement>*/
var Buffer = require('buffer').Buffer;
/*</replacement>*/

Readable.ReadableState = ReadableState;

var EE = require('events');

/*<replacement>*/
var EElistenerCount = function(emitter, type) {
  return emitter.listeners(type).length;
};
/*</replacement>*/



/*<replacement>*/
var Stream;
(function (){try{
  Stream = require('st' + 'ream');
}catch(_){}finally{
  if (!Stream)
    Stream = require('events').EventEmitter;
}}())
/*</replacement>*/

var Buffer = require('buffer').Buffer;

/*<replacement>*/
var util = require('core-util-is');
util.inherits = require('inherits');
/*</replacement>*/



/*<replacement>*/
var debugUtil = require('util');
var debug;
if (debugUtil && debugUtil.debuglog) {
  debug = debugUtil.debuglog('stream');
} else {
  debug = function () {};
}
/*</replacement>*/

var StringDecoder;

util.inherits(Readable, Stream);

var Duplex;
function ReadableState(options, stream) {
  Duplex = Duplex || require('./_stream_duplex');

  options = options || {};

  // object stream flag. Used to make read(n) ignore n and to
  // make all the buffer merging and length checks go away
  this.objectMode = !!options.objectMode;

  if (stream instanceof Duplex)
    this.objectMode = this.objectMode || !!options.readableObjectMode;

  // the point at which it stops calling _read() to fill the buffer
  // Note: 0 is a valid value, means "don't call _read preemptively ever"
  var hwm = options.highWaterMark;
  var defaultHwm = this.objectMode ? 16 : 16 * 1024;
  this.highWaterMark = (hwm || hwm === 0) ? hwm : defaultHwm;

  // cast to ints.
  this.highWaterMark = ~~this.highWaterMark;

  this.buffer = [];
  this.length = 0;
  this.pipes = null;
  this.pipesCount = 0;
  this.flowing = null;
  this.ended = false;
  this.endEmitted = false;
  this.reading = false;

  // a flag to be able to tell if the onwrite cb is called immediately,
  // or on a later tick.  We set this to true at first, because any
  // actions that shouldn't happen until "later" should generally also
  // not happen before the first write call.
  this.sync = true;

  // whenever we return null, then we set a flag to say
  // that we're awaiting a 'readable' event emission.
  this.needReadable = false;
  this.emittedReadable = false;
  this.readableListening = false;

  // Crypto is kind of old and crusty.  Historically, its default string
  // encoding is 'binary' so we have to make this configurable.
  // Everything else in the universe uses 'utf8', though.
  this.defaultEncoding = options.defaultEncoding || 'utf8';

  // when piping, we only care about 'readable' events that happen
  // after read()ing all the bytes and not getting any pushback.
  this.ranOut = false;

  // the number of writers that are awaiting a drain event in .pipe()s
  this.awaitDrain = 0;

  // if true, a maybeReadMore has been scheduled
  this.readingMore = false;

  this.decoder = null;
  this.encoding = null;
  if (options.encoding) {
    if (!StringDecoder)
      StringDecoder = require('string_decoder/').StringDecoder;
    this.decoder = new StringDecoder(options.encoding);
    this.encoding = options.encoding;
  }
}

var Duplex;
function Readable(options) {
  Duplex = Duplex || require('./_stream_duplex');

  if (!(this instanceof Readable))
    return new Readable(options);

  this._readableState = new ReadableState(options, this);

  // legacy
  this.readable = true;

  if (options && typeof options.read === 'function')
    this._read = options.read;

  Stream.call(this);
}

// Manually shove something into the read() buffer.
// This returns true if the highWaterMark has not been hit yet,
// similar to how Writable.write() returns true if you should
// write() some more.
Readable.prototype.push = function(chunk, encoding) {
  var state = this._readableState;

  if (!state.objectMode && typeof chunk === 'string') {
    encoding = encoding || state.defaultEncoding;
    if (encoding !== state.encoding) {
      chunk = new Buffer(chunk, encoding);
      encoding = '';
    }
  }

  return readableAddChunk(this, state, chunk, encoding, false);
};

// Unshift should *always* be something directly out of read()
Readable.prototype.unshift = function(chunk) {
  var state = this._readableState;
  return readableAddChunk(this, state, chunk, '', true);
};

Readable.prototype.isPaused = function() {
  return this._readableState.flowing === false;
};

function readableAddChunk(stream, state, chunk, encoding, addToFront) {
  var er = chunkInvalid(state, chunk);
  if (er) {
    stream.emit('error', er);
  } else if (chunk === null) {
    state.reading = false;
    onEofChunk(stream, state);
  } else if (state.objectMode || chunk && chunk.length > 0) {
    if (state.ended && !addToFront) {
      var e = new Error('stream.push() after EOF');
      stream.emit('error', e);
    } else if (state.endEmitted && addToFront) {
      var e = new Error('stream.unshift() after end event');
      stream.emit('error', e);
    } else {
      if (state.decoder && !addToFront && !encoding)
        chunk = state.decoder.write(chunk);

      if (!addToFront)
        state.reading = false;

      // if we want the data now, just emit it.
      if (state.flowing && state.length === 0 && !state.sync) {
        stream.emit('data', chunk);
        stream.read(0);
      } else {
        // update the buffer info.
        state.length += state.objectMode ? 1 : chunk.length;
        if (addToFront)
          state.buffer.unshift(chunk);
        else
          state.buffer.push(chunk);

        if (state.needReadable)
          emitReadable(stream);
      }

      maybeReadMore(stream, state);
    }
  } else if (!addToFront) {
    state.reading = false;
  }

  return needMoreData(state);
}


// if it's past the high water mark, we can push in some more.
// Also, if we have no data yet, we can stand some
// more bytes.  This is to work around cases where hwm=0,
// such as the repl.  Also, if the push() triggered a
// readable event, and the user called read(largeNumber) such that
// needReadable was set, then we ought to push more, so that another
// 'readable' event will be triggered.
function needMoreData(state) {
  return !state.ended &&
         (state.needReadable ||
          state.length < state.highWaterMark ||
          state.length === 0);
}

// backwards compatibility.
Readable.prototype.setEncoding = function(enc) {
  if (!StringDecoder)
    StringDecoder = require('string_decoder/').StringDecoder;
  this._readableState.decoder = new StringDecoder(enc);
  this._readableState.encoding = enc;
  return this;
};

// Don't raise the hwm > 8MB
var MAX_HWM = 0x800000;
function computeNewHighWaterMark(n) {
  if (n >= MAX_HWM) {
    n = MAX_HWM;
  } else {
    // Get the next highest power of 2
    n--;
    n |= n >>> 1;
    n |= n >>> 2;
    n |= n >>> 4;
    n |= n >>> 8;
    n |= n >>> 16;
    n++;
  }
  return n;
}

function howMuchToRead(n, state) {
  if (state.length === 0 && state.ended)
    return 0;

  if (state.objectMode)
    return n === 0 ? 0 : 1;

  if (n === null || isNaN(n)) {
    // only flow one buffer at a time
    if (state.flowing && state.buffer.length)
      return state.buffer[0].length;
    else
      return state.length;
  }

  if (n <= 0)
    return 0;

  // If we're asking for more than the target buffer level,
  // then raise the water mark.  Bump up to the next highest
  // power of 2, to prevent increasing it excessively in tiny
  // amounts.
  if (n > state.highWaterMark)
    state.highWaterMark = computeNewHighWaterMark(n);

  // don't have that much.  return null, unless we've ended.
  if (n > state.length) {
    if (!state.ended) {
      state.needReadable = true;
      return 0;
    } else {
      return state.length;
    }
  }

  return n;
}

// you can override either this method, or the async _read(n) below.
Readable.prototype.read = function(n) {
  debug('read', n);
  var state = this._readableState;
  var nOrig = n;

  if (typeof n !== 'number' || n > 0)
    state.emittedReadable = false;

  // if we're doing read(0) to trigger a readable event, but we
  // already have a bunch of data in the buffer, then just trigger
  // the 'readable' event and move on.
  if (n === 0 &&
      state.needReadable &&
      (state.length >= state.highWaterMark || state.ended)) {
    debug('read: emitReadable', state.length, state.ended);
    if (state.length === 0 && state.ended)
      endReadable(this);
    else
      emitReadable(this);
    return null;
  }

  n = howMuchToRead(n, state);

  // if we've ended, and we're now clear, then finish it up.
  if (n === 0 && state.ended) {
    if (state.length === 0)
      endReadable(this);
    return null;
  }

  // All the actual chunk generation logic needs to be
  // *below* the call to _read.  The reason is that in certain
  // synthetic stream cases, such as passthrough streams, _read
  // may be a completely synchronous operation which may change
  // the state of the read buffer, providing enough data when
  // before there was *not* enough.
  //
  // So, the steps are:
  // 1. Figure out what the state of things will be after we do
  // a read from the buffer.
  //
  // 2. If that resulting state will trigger a _read, then call _read.
  // Note that this may be asynchronous, or synchronous.  Yes, it is
  // deeply ugly to write APIs this way, but that still doesn't mean
  // that the Readable class should behave improperly, as streams are
  // designed to be sync/async agnostic.
  // Take note if the _read call is sync or async (ie, if the read call
  // has returned yet), so that we know whether or not it's safe to emit
  // 'readable' etc.
  //
  // 3. Actually pull the requested chunks out of the buffer and return.

  // if we need a readable event, then we need to do some reading.
  var doRead = state.needReadable;
  debug('need readable', doRead);

  // if we currently have less than the highWaterMark, then also read some
  if (state.length === 0 || state.length - n < state.highWaterMark) {
    doRead = true;
    debug('length less than watermark', doRead);
  }

  // however, if we've ended, then there's no point, and if we're already
  // reading, then it's unnecessary.
  if (state.ended || state.reading) {
    doRead = false;
    debug('reading or ended', doRead);
  }

  if (doRead) {
    debug('do read');
    state.reading = true;
    state.sync = true;
    // if the length is currently zero, then we *need* a readable event.
    if (state.length === 0)
      state.needReadable = true;
    // call internal read method
    this._read(state.highWaterMark);
    state.sync = false;
  }

  // If _read pushed data synchronously, then `reading` will be false,
  // and we need to re-evaluate how much data we can return to the user.
  if (doRead && !state.reading)
    n = howMuchToRead(nOrig, state);

  var ret;
  if (n > 0)
    ret = fromList(n, state);
  else
    ret = null;

  if (ret === null) {
    state.needReadable = true;
    n = 0;
  }

  state.length -= n;

  // If we have nothing in the buffer, then we want to know
  // as soon as we *do* get something into the buffer.
  if (state.length === 0 && !state.ended)
    state.needReadable = true;

  // If we tried to read() past the EOF, then emit end on the next tick.
  if (nOrig !== n && state.ended && state.length === 0)
    endReadable(this);

  if (ret !== null)
    this.emit('data', ret);

  return ret;
};

function chunkInvalid(state, chunk) {
  var er = null;
  if (!(Buffer.isBuffer(chunk)) &&
      typeof chunk !== 'string' &&
      chunk !== null &&
      chunk !== undefined &&
      !state.objectMode) {
    er = new TypeError('Invalid non-string/buffer chunk');
  }
  return er;
}


function onEofChunk(stream, state) {
  if (state.ended) return;
  if (state.decoder) {
    var chunk = state.decoder.end();
    if (chunk && chunk.length) {
      state.buffer.push(chunk);
      state.length += state.objectMode ? 1 : chunk.length;
    }
  }
  state.ended = true;

  // emit 'readable' now to make sure it gets picked up.
  emitReadable(stream);
}

// Don't emit readable right away in sync mode, because this can trigger
// another read() call => stack overflow.  This way, it might trigger
// a nextTick recursion warning, but that's not so bad.
function emitReadable(stream) {
  var state = stream._readableState;
  state.needReadable = false;
  if (!state.emittedReadable) {
    debug('emitReadable', state.flowing);
    state.emittedReadable = true;
    if (state.sync)
      processNextTick(emitReadable_, stream);
    else
      emitReadable_(stream);
  }
}

function emitReadable_(stream) {
  debug('emit readable');
  stream.emit('readable');
  flow(stream);
}


// at this point, the user has presumably seen the 'readable' event,
// and called read() to consume some data.  that may have triggered
// in turn another _read(n) call, in which case reading = true if
// it's in progress.
// However, if we're not ended, or reading, and the length < hwm,
// then go ahead and try to read some more preemptively.
function maybeReadMore(stream, state) {
  if (!state.readingMore) {
    state.readingMore = true;
    processNextTick(maybeReadMore_, stream, state);
  }
}

function maybeReadMore_(stream, state) {
  var len = state.length;
  while (!state.reading && !state.flowing && !state.ended &&
         state.length < state.highWaterMark) {
    debug('maybeReadMore read 0');
    stream.read(0);
    if (len === state.length)
      // didn't get any data, stop spinning.
      break;
    else
      len = state.length;
  }
  state.readingMore = false;
}

// abstract method.  to be overridden in specific implementation classes.
// call cb(er, data) where data is <= n in length.
// for virtual (non-string, non-buffer) streams, "length" is somewhat
// arbitrary, and perhaps not very meaningful.
Readable.prototype._read = function(n) {
  this.emit('error', new Error('not implemented'));
};

Readable.prototype.pipe = function(dest, pipeOpts) {
  var src = this;
  var state = this._readableState;

  switch (state.pipesCount) {
    case 0:
      state.pipes = dest;
      break;
    case 1:
      state.pipes = [state.pipes, dest];
      break;
    default:
      state.pipes.push(dest);
      break;
  }
  state.pipesCount += 1;
  debug('pipe count=%d opts=%j', state.pipesCount, pipeOpts);

  var doEnd = (!pipeOpts || pipeOpts.end !== false) &&
              dest !== process.stdout &&
              dest !== process.stderr;

  var endFn = doEnd ? onend : cleanup;
  if (state.endEmitted)
    processNextTick(endFn);
  else
    src.once('end', endFn);

  dest.on('unpipe', onunpipe);
  function onunpipe(readable) {
    debug('onunpipe');
    if (readable === src) {
      cleanup();
    }
  }

  function onend() {
    debug('onend');
    dest.end();
  }

  // when the dest drains, it reduces the awaitDrain counter
  // on the source.  This would be more elegant with a .once()
  // handler in flow(), but adding and removing repeatedly is
  // too slow.
  var ondrain = pipeOnDrain(src);
  dest.on('drain', ondrain);

  var cleanedUp = false;
  function cleanup() {
    debug('cleanup');
    // cleanup event handlers once the pipe is broken
    dest.removeListener('close', onclose);
    dest.removeListener('finish', onfinish);
    dest.removeListener('drain', ondrain);
    dest.removeListener('error', onerror);
    dest.removeListener('unpipe', onunpipe);
    src.removeListener('end', onend);
    src.removeListener('end', cleanup);
    src.removeListener('data', ondata);

    cleanedUp = true;

    // if the reader is waiting for a drain event from this
    // specific writer, then it would cause it to never start
    // flowing again.
    // So, if this is awaiting a drain, then we just call it now.
    // If we don't know, then assume that we are waiting for one.
    if (state.awaitDrain &&
        (!dest._writableState || dest._writableState.needDrain))
      ondrain();
  }

  src.on('data', ondata);
  function ondata(chunk) {
    debug('ondata');
    var ret = dest.write(chunk);
    if (false === ret) {
      // If the user unpiped during `dest.write()`, it is possible
      // to get stuck in a permanently paused state if that write
      // also returned false.
      if (state.pipesCount === 1 &&
          state.pipes[0] === dest &&
          src.listenerCount('data') === 1 &&
          !cleanedUp) {
        debug('false write response, pause', src._readableState.awaitDrain);
        src._readableState.awaitDrain++;
      }
      src.pause();
    }
  }

  // if the dest has an error, then stop piping into it.
  // however, don't suppress the throwing behavior for this.
  function onerror(er) {
    debug('onerror', er);
    unpipe();
    dest.removeListener('error', onerror);
    if (EElistenerCount(dest, 'error') === 0)
      dest.emit('error', er);
  }
  // This is a brutally ugly hack to make sure that our error handler
  // is attached before any userland ones.  NEVER DO THIS.
  if (!dest._events || !dest._events.error)
    dest.on('error', onerror);
  else if (isArray(dest._events.error))
    dest._events.error.unshift(onerror);
  else
    dest._events.error = [onerror, dest._events.error];


  // Both close and finish should trigger unpipe, but only once.
  function onclose() {
    dest.removeListener('finish', onfinish);
    unpipe();
  }
  dest.once('close', onclose);
  function onfinish() {
    debug('onfinish');
    dest.removeListener('close', onclose);
    unpipe();
  }
  dest.once('finish', onfinish);

  function unpipe() {
    debug('unpipe');
    src.unpipe(dest);
  }

  // tell the dest that it's being piped to
  dest.emit('pipe', src);

  // start the flow if it hasn't been started already.
  if (!state.flowing) {
    debug('pipe resume');
    src.resume();
  }

  return dest;
};

function pipeOnDrain(src) {
  return function() {
    var state = src._readableState;
    debug('pipeOnDrain', state.awaitDrain);
    if (state.awaitDrain)
      state.awaitDrain--;
    if (state.awaitDrain === 0 && EElistenerCount(src, 'data')) {
      state.flowing = true;
      flow(src);
    }
  };
}


Readable.prototype.unpipe = function(dest) {
  var state = this._readableState;

  // if we're not piping anywhere, then do nothing.
  if (state.pipesCount === 0)
    return this;

  // just one destination.  most common case.
  if (state.pipesCount === 1) {
    // passed in one, but it's not the right one.
    if (dest && dest !== state.pipes)
      return this;

    if (!dest)
      dest = state.pipes;

    // got a match.
    state.pipes = null;
    state.pipesCount = 0;
    state.flowing = false;
    if (dest)
      dest.emit('unpipe', this);
    return this;
  }

  // slow case. multiple pipe destinations.

  if (!dest) {
    // remove all.
    var dests = state.pipes;
    var len = state.pipesCount;
    state.pipes = null;
    state.pipesCount = 0;
    state.flowing = false;

    for (var i = 0; i < len; i++)
      dests[i].emit('unpipe', this);
    return this;
  }

  // try to find the right one.
  var i = indexOf(state.pipes, dest);
  if (i === -1)
    return this;

  state.pipes.splice(i, 1);
  state.pipesCount -= 1;
  if (state.pipesCount === 1)
    state.pipes = state.pipes[0];

  dest.emit('unpipe', this);

  return this;
};

// set up data events if they are asked for
// Ensure readable listeners eventually get something
Readable.prototype.on = function(ev, fn) {
  var res = Stream.prototype.on.call(this, ev, fn);

  // If listening to data, and it has not explicitly been paused,
  // then call resume to start the flow of data on the next tick.
  if (ev === 'data' && false !== this._readableState.flowing) {
    this.resume();
  }

  if (ev === 'readable' && this.readable) {
    var state = this._readableState;
    if (!state.readableListening) {
      state.readableListening = true;
      state.emittedReadable = false;
      state.needReadable = true;
      if (!state.reading) {
        processNextTick(nReadingNextTick, this);
      } else if (state.length) {
        emitReadable(this, state);
      }
    }
  }

  return res;
};
Readable.prototype.addListener = Readable.prototype.on;

function nReadingNextTick(self) {
  debug('readable nexttick read 0');
  self.read(0);
}

// pause() and resume() are remnants of the legacy readable stream API
// If the user uses them, then switch into old mode.
Readable.prototype.resume = function() {
  var state = this._readableState;
  if (!state.flowing) {
    debug('resume');
    state.flowing = true;
    resume(this, state);
  }
  return this;
};

function resume(stream, state) {
  if (!state.resumeScheduled) {
    state.resumeScheduled = true;
    processNextTick(resume_, stream, state);
  }
}

function resume_(stream, state) {
  if (!state.reading) {
    debug('resume read 0');
    stream.read(0);
  }

  state.resumeScheduled = false;
  stream.emit('resume');
  flow(stream);
  if (state.flowing && !state.reading)
    stream.read(0);
}

Readable.prototype.pause = function() {
  debug('call pause flowing=%j', this._readableState.flowing);
  if (false !== this._readableState.flowing) {
    debug('pause');
    this._readableState.flowing = false;
    this.emit('pause');
  }
  return this;
};

function flow(stream) {
  var state = stream._readableState;
  debug('flow', state.flowing);
  if (state.flowing) {
    do {
      var chunk = stream.read();
    } while (null !== chunk && state.flowing);
  }
}

// wrap an old-style stream as the async data source.
// This is *not* part of the readable stream interface.
// It is an ugly unfortunate mess of history.
Readable.prototype.wrap = function(stream) {
  var state = this._readableState;
  var paused = false;

  var self = this;
  stream.on('end', function() {
    debug('wrapped end');
    if (state.decoder && !state.ended) {
      var chunk = state.decoder.end();
      if (chunk && chunk.length)
        self.push(chunk);
    }

    self.push(null);
  });

  stream.on('data', function(chunk) {
    debug('wrapped data');
    if (state.decoder)
      chunk = state.decoder.write(chunk);

    // don't skip over falsy values in objectMode
    if (state.objectMode && (chunk === null || chunk === undefined))
      return;
    else if (!state.objectMode && (!chunk || !chunk.length))
      return;

    var ret = self.push(chunk);
    if (!ret) {
      paused = true;
      stream.pause();
    }
  });

  // proxy all the other methods.
  // important when wrapping filters and duplexes.
  for (var i in stream) {
    if (this[i] === undefined && typeof stream[i] === 'function') {
      this[i] = function(method) { return function() {
        return stream[method].apply(stream, arguments);
      }; }(i);
    }
  }

  // proxy certain important events.
  var events = ['error', 'close', 'destroy', 'pause', 'resume'];
  forEach(events, function(ev) {
    stream.on(ev, self.emit.bind(self, ev));
  });

  // when we try to consume some more bytes, simply unpause the
  // underlying stream.
  self._read = function(n) {
    debug('wrapped _read', n);
    if (paused) {
      paused = false;
      stream.resume();
    }
  };

  return self;
};


// exposed for testing purposes only.
Readable._fromList = fromList;

// Pluck off n bytes from an array of buffers.
// Length is the combined lengths of all the buffers in the list.
function fromList(n, state) {
  var list = state.buffer;
  var length = state.length;
  var stringMode = !!state.decoder;
  var objectMode = !!state.objectMode;
  var ret;

  // nothing in the list, definitely empty.
  if (list.length === 0)
    return null;

  if (length === 0)
    ret = null;
  else if (objectMode)
    ret = list.shift();
  else if (!n || n >= length) {
    // read it all, truncate the array.
    if (stringMode)
      ret = list.join('');
    else if (list.length === 1)
      ret = list[0];
    else
      ret = Buffer.concat(list, length);
    list.length = 0;
  } else {
    // read just some of it.
    if (n < list[0].length) {
      // just take a part of the first list item.
      // slice is the same for buffers and strings.
      var buf = list[0];
      ret = buf.slice(0, n);
      list[0] = buf.slice(n);
    } else if (n === list[0].length) {
      // first list is a perfect match
      ret = list.shift();
    } else {
      // complex case.
      // we have enough to cover it, but it spans past the first buffer.
      if (stringMode)
        ret = '';
      else
        ret = new Buffer(n);

      var c = 0;
      for (var i = 0, l = list.length; i < l && c < n; i++) {
        var buf = list[0];
        var cpy = Math.min(n - c, buf.length);

        if (stringMode)
          ret += buf.slice(0, cpy);
        else
          buf.copy(ret, c, 0, cpy);

        if (cpy < buf.length)
          list[0] = buf.slice(cpy);
        else
          list.shift();

        c += cpy;
      }
    }
  }

  return ret;
}

function endReadable(stream) {
  var state = stream._readableState;

  // If we get here before consuming all the bytes, then that is a
  // bug in node.  Should never happen.
  if (state.length > 0)
    throw new Error('endReadable called on non-empty stream');

  if (!state.endEmitted) {
    state.ended = true;
    processNextTick(endReadableNT, state, stream);
  }
}

function endReadableNT(state, stream) {
  // Check that we didn't get one last unshift.
  if (!state.endEmitted && state.length === 0) {
    state.endEmitted = true;
    stream.readable = false;
    stream.emit('end');
  }
}

function forEach (xs, f) {
  for (var i = 0, l = xs.length; i < l; i++) {
    f(xs[i], i);
  }
}

function indexOf (xs, x) {
  for (var i = 0, l = xs.length; i < l; i++) {
    if (xs[i] === x) return i;
  }
  return -1;
}

}).call(this,require('_process'))

},{"./_stream_duplex":79,"_process":77,"buffer":68,"core-util-is":84,"events":72,"inherits":73,"isarray":75,"process-nextick-args":85,"string_decoder/":92,"util":67}],82:[function(require,module,exports){
// a transform stream is a readable/writable stream where you do
// something with the data.  Sometimes it's called a "filter",
// but that's not a great name for it, since that implies a thing where
// some bits pass through, and others are simply ignored.  (That would
// be a valid example of a transform, of course.)
//
// While the output is causally related to the input, it's not a
// necessarily symmetric or synchronous transformation.  For example,
// a zlib stream might take multiple plain-text writes(), and then
// emit a single compressed chunk some time in the future.
//
// Here's how this works:
//
// The Transform stream has all the aspects of the readable and writable
// stream classes.  When you write(chunk), that calls _write(chunk,cb)
// internally, and returns false if there's a lot of pending writes
// buffered up.  When you call read(), that calls _read(n) until
// there's enough pending readable data buffered up.
//
// In a transform stream, the written data is placed in a buffer.  When
// _read(n) is called, it transforms the queued up data, calling the
// buffered _write cb's as it consumes chunks.  If consuming a single
// written chunk would result in multiple output chunks, then the first
// outputted bit calls the readcb, and subsequent chunks just go into
// the read buffer, and will cause it to emit 'readable' if necessary.
//
// This way, back-pressure is actually determined by the reading side,
// since _read has to be called to start processing a new chunk.  However,
// a pathological inflate type of transform can cause excessive buffering
// here.  For example, imagine a stream where every byte of input is
// interpreted as an integer from 0-255, and then results in that many
// bytes of output.  Writing the 4 bytes {ff,ff,ff,ff} would result in
// 1kb of data being output.  In this case, you could write a very small
// amount of input, and end up with a very large amount of output.  In
// such a pathological inflating mechanism, there'd be no way to tell
// the system to stop doing the transform.  A single 4MB write could
// cause the system to run out of memory.
//
// However, even in such a pathological case, only a single written chunk
// would be consumed, and then the rest would wait (un-transformed) until
// the results of the previous transformed chunk were consumed.

'use strict';

module.exports = Transform;

var Duplex = require('./_stream_duplex');

/*<replacement>*/
var util = require('core-util-is');
util.inherits = require('inherits');
/*</replacement>*/

util.inherits(Transform, Duplex);


function TransformState(stream) {
  this.afterTransform = function(er, data) {
    return afterTransform(stream, er, data);
  };

  this.needTransform = false;
  this.transforming = false;
  this.writecb = null;
  this.writechunk = null;
}

function afterTransform(stream, er, data) {
  var ts = stream._transformState;
  ts.transforming = false;

  var cb = ts.writecb;

  if (!cb)
    return stream.emit('error', new Error('no writecb in Transform class'));

  ts.writechunk = null;
  ts.writecb = null;

  if (data !== null && data !== undefined)
    stream.push(data);

  if (cb)
    cb(er);

  var rs = stream._readableState;
  rs.reading = false;
  if (rs.needReadable || rs.length < rs.highWaterMark) {
    stream._read(rs.highWaterMark);
  }
}


function Transform(options) {
  if (!(this instanceof Transform))
    return new Transform(options);

  Duplex.call(this, options);

  this._transformState = new TransformState(this);

  // when the writable side finishes, then flush out anything remaining.
  var stream = this;

  // start out asking for a readable event once data is transformed.
  this._readableState.needReadable = true;

  // we have implemented the _read method, and done the other things
  // that Readable wants before the first _read call, so unset the
  // sync guard flag.
  this._readableState.sync = false;

  if (options) {
    if (typeof options.transform === 'function')
      this._transform = options.transform;

    if (typeof options.flush === 'function')
      this._flush = options.flush;
  }

  this.once('prefinish', function() {
    if (typeof this._flush === 'function')
      this._flush(function(er) {
        done(stream, er);
      });
    else
      done(stream);
  });
}

Transform.prototype.push = function(chunk, encoding) {
  this._transformState.needTransform = false;
  return Duplex.prototype.push.call(this, chunk, encoding);
};

// This is the part where you do stuff!
// override this function in implementation classes.
// 'chunk' is an input chunk.
//
// Call `push(newChunk)` to pass along transformed output
// to the readable side.  You may call 'push' zero or more times.
//
// Call `cb(err)` when you are done with this chunk.  If you pass
// an error, then that'll put the hurt on the whole operation.  If you
// never call cb(), then you'll never get another chunk.
Transform.prototype._transform = function(chunk, encoding, cb) {
  throw new Error('not implemented');
};

Transform.prototype._write = function(chunk, encoding, cb) {
  var ts = this._transformState;
  ts.writecb = cb;
  ts.writechunk = chunk;
  ts.writeencoding = encoding;
  if (!ts.transforming) {
    var rs = this._readableState;
    if (ts.needTransform ||
        rs.needReadable ||
        rs.length < rs.highWaterMark)
      this._read(rs.highWaterMark);
  }
};

// Doesn't matter what the args are here.
// _transform does all the work.
// That we got here means that the readable side wants more data.
Transform.prototype._read = function(n) {
  var ts = this._transformState;

  if (ts.writechunk !== null && ts.writecb && !ts.transforming) {
    ts.transforming = true;
    this._transform(ts.writechunk, ts.writeencoding, ts.afterTransform);
  } else {
    // mark that we need a transform, so that any data that comes in
    // will get processed, now that we've asked for it.
    ts.needTransform = true;
  }
};


function done(stream, er) {
  if (er)
    return stream.emit('error', er);

  // if there's nothing in the write buffer, then that means
  // that nothing more will ever be provided
  var ws = stream._writableState;
  var ts = stream._transformState;

  if (ws.length)
    throw new Error('calling transform done when ws.length != 0');

  if (ts.transforming)
    throw new Error('calling transform done when still transforming');

  return stream.push(null);
}

},{"./_stream_duplex":79,"core-util-is":84,"inherits":73}],83:[function(require,module,exports){
// A bit simpler than readable streams.
// Implement an async ._write(chunk, encoding, cb), and it'll handle all
// the drain event emission and buffering.

'use strict';

module.exports = Writable;

/*<replacement>*/
var processNextTick = require('process-nextick-args');
/*</replacement>*/


/*<replacement>*/
var Buffer = require('buffer').Buffer;
/*</replacement>*/

Writable.WritableState = WritableState;


/*<replacement>*/
var util = require('core-util-is');
util.inherits = require('inherits');
/*</replacement>*/


/*<replacement>*/
var internalUtil = {
  deprecate: require('util-deprecate')
};
/*</replacement>*/



/*<replacement>*/
var Stream;
(function (){try{
  Stream = require('st' + 'ream');
}catch(_){}finally{
  if (!Stream)
    Stream = require('events').EventEmitter;
}}())
/*</replacement>*/

var Buffer = require('buffer').Buffer;

util.inherits(Writable, Stream);

function nop() {}

function WriteReq(chunk, encoding, cb) {
  this.chunk = chunk;
  this.encoding = encoding;
  this.callback = cb;
  this.next = null;
}

var Duplex;
function WritableState(options, stream) {
  Duplex = Duplex || require('./_stream_duplex');

  options = options || {};

  // object stream flag to indicate whether or not this stream
  // contains buffers or objects.
  this.objectMode = !!options.objectMode;

  if (stream instanceof Duplex)
    this.objectMode = this.objectMode || !!options.writableObjectMode;

  // the point at which write() starts returning false
  // Note: 0 is a valid value, means that we always return false if
  // the entire buffer is not flushed immediately on write()
  var hwm = options.highWaterMark;
  var defaultHwm = this.objectMode ? 16 : 16 * 1024;
  this.highWaterMark = (hwm || hwm === 0) ? hwm : defaultHwm;

  // cast to ints.
  this.highWaterMark = ~~this.highWaterMark;

  this.needDrain = false;
  // at the start of calling end()
  this.ending = false;
  // when end() has been called, and returned
  this.ended = false;
  // when 'finish' is emitted
  this.finished = false;

  // should we decode strings into buffers before passing to _write?
  // this is here so that some node-core streams can optimize string
  // handling at a lower level.
  var noDecode = options.decodeStrings === false;
  this.decodeStrings = !noDecode;

  // Crypto is kind of old and crusty.  Historically, its default string
  // encoding is 'binary' so we have to make this configurable.
  // Everything else in the universe uses 'utf8', though.
  this.defaultEncoding = options.defaultEncoding || 'utf8';

  // not an actual buffer we keep track of, but a measurement
  // of how much we're waiting to get pushed to some underlying
  // socket or file.
  this.length = 0;

  // a flag to see when we're in the middle of a write.
  this.writing = false;

  // when true all writes will be buffered until .uncork() call
  this.corked = 0;

  // a flag to be able to tell if the onwrite cb is called immediately,
  // or on a later tick.  We set this to true at first, because any
  // actions that shouldn't happen until "later" should generally also
  // not happen before the first write call.
  this.sync = true;

  // a flag to know if we're processing previously buffered items, which
  // may call the _write() callback in the same tick, so that we don't
  // end up in an overlapped onwrite situation.
  this.bufferProcessing = false;

  // the callback that's passed to _write(chunk,cb)
  this.onwrite = function(er) {
    onwrite(stream, er);
  };

  // the callback that the user supplies to write(chunk,encoding,cb)
  this.writecb = null;

  // the amount that is being written when _write is called.
  this.writelen = 0;

  this.bufferedRequest = null;
  this.lastBufferedRequest = null;

  // number of pending user-supplied write callbacks
  // this must be 0 before 'finish' can be emitted
  this.pendingcb = 0;

  // emit prefinish if the only thing we're waiting for is _write cbs
  // This is relevant for synchronous Transform streams
  this.prefinished = false;

  // True if the error was already emitted and should not be thrown again
  this.errorEmitted = false;
}

WritableState.prototype.getBuffer = function writableStateGetBuffer() {
  var current = this.bufferedRequest;
  var out = [];
  while (current) {
    out.push(current);
    current = current.next;
  }
  return out;
};

(function (){try {
Object.defineProperty(WritableState.prototype, 'buffer', {
  get: internalUtil.deprecate(function() {
    return this.getBuffer();
  }, '_writableState.buffer is deprecated. Use _writableState.getBuffer ' +
     'instead.')
});
}catch(_){}}());


var Duplex;
function Writable(options) {
  Duplex = Duplex || require('./_stream_duplex');

  // Writable ctor is applied to Duplexes, though they're not
  // instanceof Writable, they're instanceof Readable.
  if (!(this instanceof Writable) && !(this instanceof Duplex))
    return new Writable(options);

  this._writableState = new WritableState(options, this);

  // legacy.
  this.writable = true;

  if (options) {
    if (typeof options.write === 'function')
      this._write = options.write;

    if (typeof options.writev === 'function')
      this._writev = options.writev;
  }

  Stream.call(this);
}

// Otherwise people can pipe Writable streams, which is just wrong.
Writable.prototype.pipe = function() {
  this.emit('error', new Error('Cannot pipe. Not readable.'));
};


function writeAfterEnd(stream, cb) {
  var er = new Error('write after end');
  // TODO: defer error events consistently everywhere, not just the cb
  stream.emit('error', er);
  processNextTick(cb, er);
}

// If we get something that is not a buffer, string, null, or undefined,
// and we're not in objectMode, then that's an error.
// Otherwise stream chunks are all considered to be of length=1, and the
// watermarks determine how many objects to keep in the buffer, rather than
// how many bytes or characters.
function validChunk(stream, state, chunk, cb) {
  var valid = true;

  if (!(Buffer.isBuffer(chunk)) &&
      typeof chunk !== 'string' &&
      chunk !== null &&
      chunk !== undefined &&
      !state.objectMode) {
    var er = new TypeError('Invalid non-string/buffer chunk');
    stream.emit('error', er);
    processNextTick(cb, er);
    valid = false;
  }
  return valid;
}

Writable.prototype.write = function(chunk, encoding, cb) {
  var state = this._writableState;
  var ret = false;

  if (typeof encoding === 'function') {
    cb = encoding;
    encoding = null;
  }

  if (Buffer.isBuffer(chunk))
    encoding = 'buffer';
  else if (!encoding)
    encoding = state.defaultEncoding;

  if (typeof cb !== 'function')
    cb = nop;

  if (state.ended)
    writeAfterEnd(this, cb);
  else if (validChunk(this, state, chunk, cb)) {
    state.pendingcb++;
    ret = writeOrBuffer(this, state, chunk, encoding, cb);
  }

  return ret;
};

Writable.prototype.cork = function() {
  var state = this._writableState;

  state.corked++;
};

Writable.prototype.uncork = function() {
  var state = this._writableState;

  if (state.corked) {
    state.corked--;

    if (!state.writing &&
        !state.corked &&
        !state.finished &&
        !state.bufferProcessing &&
        state.bufferedRequest)
      clearBuffer(this, state);
  }
};

Writable.prototype.setDefaultEncoding = function setDefaultEncoding(encoding) {
  // node::ParseEncoding() requires lower case.
  if (typeof encoding === 'string')
    encoding = encoding.toLowerCase();
  if (!(['hex', 'utf8', 'utf-8', 'ascii', 'binary', 'base64',
'ucs2', 'ucs-2','utf16le', 'utf-16le', 'raw']
.indexOf((encoding + '').toLowerCase()) > -1))
    throw new TypeError('Unknown encoding: ' + encoding);
  this._writableState.defaultEncoding = encoding;
};

function decodeChunk(state, chunk, encoding) {
  if (!state.objectMode &&
      state.decodeStrings !== false &&
      typeof chunk === 'string') {
    chunk = new Buffer(chunk, encoding);
  }
  return chunk;
}

// if we're already writing something, then just put this
// in the queue, and wait our turn.  Otherwise, call _write
// If we return false, then we need a drain event, so set that flag.
function writeOrBuffer(stream, state, chunk, encoding, cb) {
  chunk = decodeChunk(state, chunk, encoding);

  if (Buffer.isBuffer(chunk))
    encoding = 'buffer';
  var len = state.objectMode ? 1 : chunk.length;

  state.length += len;

  var ret = state.length < state.highWaterMark;
  // we must ensure that previous needDrain will not be reset to false.
  if (!ret)
    state.needDrain = true;

  if (state.writing || state.corked) {
    var last = state.lastBufferedRequest;
    state.lastBufferedRequest = new WriteReq(chunk, encoding, cb);
    if (last) {
      last.next = state.lastBufferedRequest;
    } else {
      state.bufferedRequest = state.lastBufferedRequest;
    }
  } else {
    doWrite(stream, state, false, len, chunk, encoding, cb);
  }

  return ret;
}

function doWrite(stream, state, writev, len, chunk, encoding, cb) {
  state.writelen = len;
  state.writecb = cb;
  state.writing = true;
  state.sync = true;
  if (writev)
    stream._writev(chunk, state.onwrite);
  else
    stream._write(chunk, encoding, state.onwrite);
  state.sync = false;
}

function onwriteError(stream, state, sync, er, cb) {
  --state.pendingcb;
  if (sync)
    processNextTick(cb, er);
  else
    cb(er);

  stream._writableState.errorEmitted = true;
  stream.emit('error', er);
}

function onwriteStateUpdate(state) {
  state.writing = false;
  state.writecb = null;
  state.length -= state.writelen;
  state.writelen = 0;
}

function onwrite(stream, er) {
  var state = stream._writableState;
  var sync = state.sync;
  var cb = state.writecb;

  onwriteStateUpdate(state);

  if (er)
    onwriteError(stream, state, sync, er, cb);
  else {
    // Check if we're actually ready to finish, but don't emit yet
    var finished = needFinish(state);

    if (!finished &&
        !state.corked &&
        !state.bufferProcessing &&
        state.bufferedRequest) {
      clearBuffer(stream, state);
    }

    if (sync) {
      processNextTick(afterWrite, stream, state, finished, cb);
    } else {
      afterWrite(stream, state, finished, cb);
    }
  }
}

function afterWrite(stream, state, finished, cb) {
  if (!finished)
    onwriteDrain(stream, state);
  state.pendingcb--;
  cb();
  finishMaybe(stream, state);
}

// Must force callback to be called on nextTick, so that we don't
// emit 'drain' before the write() consumer gets the 'false' return
// value, and has a chance to attach a 'drain' listener.
function onwriteDrain(stream, state) {
  if (state.length === 0 && state.needDrain) {
    state.needDrain = false;
    stream.emit('drain');
  }
}


// if there's something in the buffer waiting, then process it
function clearBuffer(stream, state) {
  state.bufferProcessing = true;
  var entry = state.bufferedRequest;

  if (stream._writev && entry && entry.next) {
    // Fast case, write everything using _writev()
    var buffer = [];
    var cbs = [];
    while (entry) {
      cbs.push(entry.callback);
      buffer.push(entry);
      entry = entry.next;
    }

    // count the one we are adding, as well.
    // TODO(isaacs) clean this up
    state.pendingcb++;
    state.lastBufferedRequest = null;
    doWrite(stream, state, true, state.length, buffer, '', function(err) {
      for (var i = 0; i < cbs.length; i++) {
        state.pendingcb--;
        cbs[i](err);
      }
    });

    // Clear buffer
  } else {
    // Slow case, write chunks one-by-one
    while (entry) {
      var chunk = entry.chunk;
      var encoding = entry.encoding;
      var cb = entry.callback;
      var len = state.objectMode ? 1 : chunk.length;

      doWrite(stream, state, false, len, chunk, encoding, cb);
      entry = entry.next;
      // if we didn't call the onwrite immediately, then
      // it means that we need to wait until it does.
      // also, that means that the chunk and cb are currently
      // being processed, so move the buffer counter past them.
      if (state.writing) {
        break;
      }
    }

    if (entry === null)
      state.lastBufferedRequest = null;
  }
  state.bufferedRequest = entry;
  state.bufferProcessing = false;
}

Writable.prototype._write = function(chunk, encoding, cb) {
  cb(new Error('not implemented'));
};

Writable.prototype._writev = null;

Writable.prototype.end = function(chunk, encoding, cb) {
  var state = this._writableState;

  if (typeof chunk === 'function') {
    cb = chunk;
    chunk = null;
    encoding = null;
  } else if (typeof encoding === 'function') {
    cb = encoding;
    encoding = null;
  }

  if (chunk !== null && chunk !== undefined)
    this.write(chunk, encoding);

  // .end() fully uncorks
  if (state.corked) {
    state.corked = 1;
    this.uncork();
  }

  // ignore unnecessary end() calls.
  if (!state.ending && !state.finished)
    endWritable(this, state, cb);
};


function needFinish(state) {
  return (state.ending &&
          state.length === 0 &&
          state.bufferedRequest === null &&
          !state.finished &&
          !state.writing);
}

function prefinish(stream, state) {
  if (!state.prefinished) {
    state.prefinished = true;
    stream.emit('prefinish');
  }
}

function finishMaybe(stream, state) {
  var need = needFinish(state);
  if (need) {
    if (state.pendingcb === 0) {
      prefinish(stream, state);
      state.finished = true;
      stream.emit('finish');
    } else {
      prefinish(stream, state);
    }
  }
  return need;
}

function endWritable(stream, state, cb) {
  state.ending = true;
  finishMaybe(stream, state);
  if (cb) {
    if (state.finished)
      processNextTick(cb);
    else
      stream.once('finish', cb);
  }
  state.ended = true;
}

},{"./_stream_duplex":79,"buffer":68,"core-util-is":84,"events":72,"inherits":73,"process-nextick-args":85,"util-deprecate":86}],84:[function(require,module,exports){
(function (Buffer){
// Copyright Joyent, Inc. and other Node contributors.
//
// Permission is hereby granted, free of charge, to any person obtaining a
// copy of this software and associated documentation files (the
// "Software"), to deal in the Software without restriction, including
// without limitation the rights to use, copy, modify, merge, publish,
// distribute, sublicense, and/or sell copies of the Software, and to permit
// persons to whom the Software is furnished to do so, subject to the
// following conditions:
//
// The above copyright notice and this permission notice shall be included
// in all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
// OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
// MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN
// NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
// DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
// OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE
// USE OR OTHER DEALINGS IN THE SOFTWARE.

// NOTE: These type checking functions intentionally don't use `instanceof`
// because it is fragile and can be easily faked with `Object.create()`.

function isArray(arg) {
  if (Array.isArray) {
    return Array.isArray(arg);
  }
  return objectToString(arg) === '[object Array]';
}
exports.isArray = isArray;

function isBoolean(arg) {
  return typeof arg === 'boolean';
}
exports.isBoolean = isBoolean;

function isNull(arg) {
  return arg === null;
}
exports.isNull = isNull;

function isNullOrUndefined(arg) {
  return arg == null;
}
exports.isNullOrUndefined = isNullOrUndefined;

function isNumber(arg) {
  return typeof arg === 'number';
}
exports.isNumber = isNumber;

function isString(arg) {
  return typeof arg === 'string';
}
exports.isString = isString;

function isSymbol(arg) {
  return typeof arg === 'symbol';
}
exports.isSymbol = isSymbol;

function isUndefined(arg) {
  return arg === void 0;
}
exports.isUndefined = isUndefined;

function isRegExp(re) {
  return objectToString(re) === '[object RegExp]';
}
exports.isRegExp = isRegExp;

function isObject(arg) {
  return typeof arg === 'object' && arg !== null;
}
exports.isObject = isObject;

function isDate(d) {
  return objectToString(d) === '[object Date]';
}
exports.isDate = isDate;

function isError(e) {
  return (objectToString(e) === '[object Error]' || e instanceof Error);
}
exports.isError = isError;

function isFunction(arg) {
  return typeof arg === 'function';
}
exports.isFunction = isFunction;

function isPrimitive(arg) {
  return arg === null ||
         typeof arg === 'boolean' ||
         typeof arg === 'number' ||
         typeof arg === 'string' ||
         typeof arg === 'symbol' ||  // ES6 symbol
         typeof arg === 'undefined';
}
exports.isPrimitive = isPrimitive;

exports.isBuffer = Buffer.isBuffer;

function objectToString(o) {
  return Object.prototype.toString.call(o);
}

}).call(this,{"isBuffer":require("../../../../insert-module-globals/node_modules/is-buffer/index.js")})

},{"../../../../insert-module-globals/node_modules/is-buffer/index.js":74}],85:[function(require,module,exports){
(function (process){
'use strict';

if (!process.version ||
    process.version.indexOf('v0.') === 0 ||
    process.version.indexOf('v1.') === 0 && process.version.indexOf('v1.8.') !== 0) {
  module.exports = nextTick;
} else {
  module.exports = process.nextTick;
}

function nextTick(fn) {
  var args = new Array(arguments.length - 1);
  var i = 0;
  while (i < args.length) {
    args[i++] = arguments[i];
  }
  process.nextTick(function afterTick() {
    fn.apply(null, args);
  });
}

}).call(this,require('_process'))

},{"_process":77}],86:[function(require,module,exports){
(function (global){

/**
 * Module exports.
 */

module.exports = deprecate;

/**
 * Mark that a method should not be used.
 * Returns a modified function which warns once by default.
 *
 * If `localStorage.noDeprecation = true` is set, then it is a no-op.
 *
 * If `localStorage.throwDeprecation = true` is set, then deprecated functions
 * will throw an Error when invoked.
 *
 * If `localStorage.traceDeprecation = true` is set, then deprecated functions
 * will invoke `console.trace()` instead of `console.error()`.
 *
 * @param {Function} fn - the function to deprecate
 * @param {String} msg - the string to print to the console when `fn` is invoked
 * @returns {Function} a new "deprecated" version of `fn`
 * @api public
 */

function deprecate (fn, msg) {
  if (config('noDeprecation')) {
    return fn;
  }

  var warned = false;
  function deprecated() {
    if (!warned) {
      if (config('throwDeprecation')) {
        throw new Error(msg);
      } else if (config('traceDeprecation')) {
        console.trace(msg);
      } else {
        console.warn(msg);
      }
      warned = true;
    }
    return fn.apply(this, arguments);
  }

  return deprecated;
}

/**
 * Checks `localStorage` for boolean values for the given `name`.
 *
 * @param {String} name
 * @returns {Boolean}
 * @api private
 */

function config (name) {
  // accessing global.localStorage can trigger a DOMException in sandboxed iframes
  try {
    if (!global.localStorage) return false;
  } catch (_) {
    return false;
  }
  var val = global.localStorage[name];
  if (null == val) return false;
  return String(val).toLowerCase() === 'true';
}

}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})

},{}],87:[function(require,module,exports){
module.exports = require("./lib/_stream_passthrough.js")

},{"./lib/_stream_passthrough.js":80}],88:[function(require,module,exports){
var Stream = (function (){
  try {
    return require('st' + 'ream'); // hack to fix a circular dependency issue when used with browserify
  } catch(_){}
}());
exports = module.exports = require('./lib/_stream_readable.js');
exports.Stream = Stream || exports;
exports.Readable = exports;
exports.Writable = require('./lib/_stream_writable.js');
exports.Duplex = require('./lib/_stream_duplex.js');
exports.Transform = require('./lib/_stream_transform.js');
exports.PassThrough = require('./lib/_stream_passthrough.js');

},{"./lib/_stream_duplex.js":79,"./lib/_stream_passthrough.js":80,"./lib/_stream_readable.js":81,"./lib/_stream_transform.js":82,"./lib/_stream_writable.js":83}],89:[function(require,module,exports){
module.exports = require("./lib/_stream_transform.js")

},{"./lib/_stream_transform.js":82}],90:[function(require,module,exports){
module.exports = require("./lib/_stream_writable.js")

},{"./lib/_stream_writable.js":83}],91:[function(require,module,exports){
// Copyright Joyent, Inc. and other Node contributors.
//
// Permission is hereby granted, free of charge, to any person obtaining a
// copy of this software and associated documentation files (the
// "Software"), to deal in the Software without restriction, including
// without limitation the rights to use, copy, modify, merge, publish,
// distribute, sublicense, and/or sell copies of the Software, and to permit
// persons to whom the Software is furnished to do so, subject to the
// following conditions:
//
// The above copyright notice and this permission notice shall be included
// in all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
// OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
// MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN
// NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
// DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
// OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE
// USE OR OTHER DEALINGS IN THE SOFTWARE.

module.exports = Stream;

var EE = require('events').EventEmitter;
var inherits = require('inherits');

inherits(Stream, EE);
Stream.Readable = require('readable-stream/readable.js');
Stream.Writable = require('readable-stream/writable.js');
Stream.Duplex = require('readable-stream/duplex.js');
Stream.Transform = require('readable-stream/transform.js');
Stream.PassThrough = require('readable-stream/passthrough.js');

// Backwards-compat with node 0.4.x
Stream.Stream = Stream;



// old-style streams.  Note that the pipe method (the only relevant
// part of this class) is overridden in the Readable class.

function Stream() {
  EE.call(this);
}

Stream.prototype.pipe = function(dest, options) {
  var source = this;

  function ondata(chunk) {
    if (dest.writable) {
      if (false === dest.write(chunk) && source.pause) {
        source.pause();
      }
    }
  }

  source.on('data', ondata);

  function ondrain() {
    if (source.readable && source.resume) {
      source.resume();
    }
  }

  dest.on('drain', ondrain);

  // If the 'end' option is not supplied, dest.end() will be called when
  // source gets the 'end' or 'close' events.  Only dest.end() once.
  if (!dest._isStdio && (!options || options.end !== false)) {
    source.on('end', onend);
    source.on('close', onclose);
  }

  var didOnEnd = false;
  function onend() {
    if (didOnEnd) return;
    didOnEnd = true;

    dest.end();
  }


  function onclose() {
    if (didOnEnd) return;
    didOnEnd = true;

    if (typeof dest.destroy === 'function') dest.destroy();
  }

  // don't leave dangling pipes when there are errors.
  function onerror(er) {
    cleanup();
    if (EE.listenerCount(this, 'error') === 0) {
      throw er; // Unhandled stream error in pipe.
    }
  }

  source.on('error', onerror);
  dest.on('error', onerror);

  // remove all the event listeners that were added.
  function cleanup() {
    source.removeListener('data', ondata);
    dest.removeListener('drain', ondrain);

    source.removeListener('end', onend);
    source.removeListener('close', onclose);

    source.removeListener('error', onerror);
    dest.removeListener('error', onerror);

    source.removeListener('end', cleanup);
    source.removeListener('close', cleanup);

    dest.removeListener('close', cleanup);
  }

  source.on('end', cleanup);
  source.on('close', cleanup);

  dest.on('close', cleanup);

  dest.emit('pipe', source);

  // Allow for unix-like usage: A.pipe(B).pipe(C)
  return dest;
};

},{"events":72,"inherits":73,"readable-stream/duplex.js":78,"readable-stream/passthrough.js":87,"readable-stream/readable.js":88,"readable-stream/transform.js":89,"readable-stream/writable.js":90}],92:[function(require,module,exports){
// Copyright Joyent, Inc. and other Node contributors.
//
// Permission is hereby granted, free of charge, to any person obtaining a
// copy of this software and associated documentation files (the
// "Software"), to deal in the Software without restriction, including
// without limitation the rights to use, copy, modify, merge, publish,
// distribute, sublicense, and/or sell copies of the Software, and to permit
// persons to whom the Software is furnished to do so, subject to the
// following conditions:
//
// The above copyright notice and this permission notice shall be included
// in all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
// OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
// MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN
// NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
// DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
// OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE
// USE OR OTHER DEALINGS IN THE SOFTWARE.

var Buffer = require('buffer').Buffer;

var isBufferEncoding = Buffer.isEncoding
  || function(encoding) {
       switch (encoding && encoding.toLowerCase()) {
         case 'hex': case 'utf8': case 'utf-8': case 'ascii': case 'binary': case 'base64': case 'ucs2': case 'ucs-2': case 'utf16le': case 'utf-16le': case 'raw': return true;
         default: return false;
       }
     }


function assertEncoding(encoding) {
  if (encoding && !isBufferEncoding(encoding)) {
    throw new Error('Unknown encoding: ' + encoding);
  }
}

// StringDecoder provides an interface for efficiently splitting a series of
// buffers into a series of JS strings without breaking apart multi-byte
// characters. CESU-8 is handled as part of the UTF-8 encoding.
//
// @TODO Handling all encodings inside a single object makes it very difficult
// to reason about this code, so it should be split up in the future.
// @TODO There should be a utf8-strict encoding that rejects invalid UTF-8 code
// points as used by CESU-8.
var StringDecoder = exports.StringDecoder = function(encoding) {
  this.encoding = (encoding || 'utf8').toLowerCase().replace(/[-_]/, '');
  assertEncoding(encoding);
  switch (this.encoding) {
    case 'utf8':
      // CESU-8 represents each of Surrogate Pair by 3-bytes
      this.surrogateSize = 3;
      break;
    case 'ucs2':
    case 'utf16le':
      // UTF-16 represents each of Surrogate Pair by 2-bytes
      this.surrogateSize = 2;
      this.detectIncompleteChar = utf16DetectIncompleteChar;
      break;
    case 'base64':
      // Base-64 stores 3 bytes in 4 chars, and pads the remainder.
      this.surrogateSize = 3;
      this.detectIncompleteChar = base64DetectIncompleteChar;
      break;
    default:
      this.write = passThroughWrite;
      return;
  }

  // Enough space to store all bytes of a single character. UTF-8 needs 4
  // bytes, but CESU-8 may require up to 6 (3 bytes per surrogate).
  this.charBuffer = new Buffer(6);
  // Number of bytes received for the current incomplete multi-byte character.
  this.charReceived = 0;
  // Number of bytes expected for the current incomplete multi-byte character.
  this.charLength = 0;
};


// write decodes the given buffer and returns it as JS string that is
// guaranteed to not contain any partial multi-byte characters. Any partial
// character found at the end of the buffer is buffered up, and will be
// returned when calling write again with the remaining bytes.
//
// Note: Converting a Buffer containing an orphan surrogate to a String
// currently works, but converting a String to a Buffer (via `new Buffer`, or
// Buffer#write) will replace incomplete surrogates with the unicode
// replacement character. See https://codereview.chromium.org/121173009/ .
StringDecoder.prototype.write = function(buffer) {
  var charStr = '';
  // if our last write ended with an incomplete multibyte character
  while (this.charLength) {
    // determine how many remaining bytes this buffer has to offer for this char
    var available = (buffer.length >= this.charLength - this.charReceived) ?
        this.charLength - this.charReceived :
        buffer.length;

    // add the new bytes to the char buffer
    buffer.copy(this.charBuffer, this.charReceived, 0, available);
    this.charReceived += available;

    if (this.charReceived < this.charLength) {
      // still not enough chars in this buffer? wait for more ...
      return '';
    }

    // remove bytes belonging to the current character from the buffer
    buffer = buffer.slice(available, buffer.length);

    // get the character that was split
    charStr = this.charBuffer.slice(0, this.charLength).toString(this.encoding);

    // CESU-8: lead surrogate (D800-DBFF) is also the incomplete character
    var charCode = charStr.charCodeAt(charStr.length - 1);
    if (charCode >= 0xD800 && charCode <= 0xDBFF) {
      this.charLength += this.surrogateSize;
      charStr = '';
      continue;
    }
    this.charReceived = this.charLength = 0;

    // if there are no more bytes in this buffer, just emit our char
    if (buffer.length === 0) {
      return charStr;
    }
    break;
  }

  // determine and set charLength / charReceived
  this.detectIncompleteChar(buffer);

  var end = buffer.length;
  if (this.charLength) {
    // buffer the incomplete character bytes we got
    buffer.copy(this.charBuffer, 0, buffer.length - this.charReceived, end);
    end -= this.charReceived;
  }

  charStr += buffer.toString(this.encoding, 0, end);

  var end = charStr.length - 1;
  var charCode = charStr.charCodeAt(end);
  // CESU-8: lead surrogate (D800-DBFF) is also the incomplete character
  if (charCode >= 0xD800 && charCode <= 0xDBFF) {
    var size = this.surrogateSize;
    this.charLength += size;
    this.charReceived += size;
    this.charBuffer.copy(this.charBuffer, size, 0, size);
    buffer.copy(this.charBuffer, 0, 0, size);
    return charStr.substring(0, end);
  }

  // or just emit the charStr
  return charStr;
};

// detectIncompleteChar determines if there is an incomplete UTF-8 character at
// the end of the given buffer. If so, it sets this.charLength to the byte
// length that character, and sets this.charReceived to the number of bytes
// that are available for this character.
StringDecoder.prototype.detectIncompleteChar = function(buffer) {
  // determine how many bytes we have to check at the end of this buffer
  var i = (buffer.length >= 3) ? 3 : buffer.length;

  // Figure out if one of the last i bytes of our buffer announces an
  // incomplete char.
  for (; i > 0; i--) {
    var c = buffer[buffer.length - i];

    // See http://en.wikipedia.org/wiki/UTF-8#Description

    // 110XXXXX
    if (i == 1 && c >> 5 == 0x06) {
      this.charLength = 2;
      break;
    }

    // 1110XXXX
    if (i <= 2 && c >> 4 == 0x0E) {
      this.charLength = 3;
      break;
    }

    // 11110XXX
    if (i <= 3 && c >> 3 == 0x1E) {
      this.charLength = 4;
      break;
    }
  }
  this.charReceived = i;
};

StringDecoder.prototype.end = function(buffer) {
  var res = '';
  if (buffer && buffer.length)
    res = this.write(buffer);

  if (this.charReceived) {
    var cr = this.charReceived;
    var buf = this.charBuffer;
    var enc = this.encoding;
    res += buf.slice(0, cr).toString(enc);
  }

  return res;
};

function passThroughWrite(buffer) {
  return buffer.toString(this.encoding);
}

function utf16DetectIncompleteChar(buffer) {
  this.charReceived = buffer.length % 2;
  this.charLength = this.charReceived ? 2 : 0;
}

function base64DetectIncompleteChar(buffer) {
  this.charReceived = buffer.length % 3;
  this.charLength = this.charReceived ? 3 : 0;
}

},{"buffer":68}],93:[function(require,module,exports){
var test = require('tape'),
    driver = require('automagic-ui'),
    createTimePicker = require('../../'),
    fastn = require('fastn')({
        _generic: require('fastn/genericComponent'),
        text: require('fastn/textComponent')
    }),
    model = {};

window.onload = function() {
    var timePicker = createTimePicker(),
        timeBinding = fastn.binding('time|*', function(time){
            return time ? 'Time is set to ' + time : '';
        }).attach(model),
        timeLabel = fastn('label', timeBinding);

    timeLabel.attach(model).render();

    document.body.appendChild(timePicker.element);
    document.body.appendChild(timeLabel.element);

    timePicker.time.on('change', function(time){
        fastn.Model.store(model, 'time', time);
    });

    driver.init({
        runDelay: 2000
    });

    test('timepicker elements are in view', function(t){
        t.plan(1);

        driver()
            .findUi('hours', 'field')
            .findUi('minutes', 'field')
            .findUi('seconds', 'field')
            .findUi('meridiem', 'field')
            .go(function(error, result){
                t.ok(result, 'found timepicker elements');
            });
    });

    test('state', function(t) {
        t.plan(3);

        driver()
            .changeValue('hours', 'field', '10')
            .changeValue('minutes', 'field', '10')
            .changeValue('seconds', 'field', '10')
            .go(function(error, result) {
                if(error) {
                    console.log(error);
                }

                t.equal(timePicker.hours(), 10, 'hours set correctly');
                t.equal(timePicker.minutes(), 10, 'minutes set correctly');
                t.equal(timePicker.seconds(), 10, 'seconds set correctly');
            });
    });

};

},{"../../":1,"automagic-ui":2,"fastn":17,"fastn/genericComponent":16,"fastn/textComponent":33,"tape":37}],94:[function(require,module,exports){
var doc = require('doc-js'),
    crel = require('crel'),
    morrison = require('morrison'),
    hoursRegex = /^[1-9]$|^0[1-9]$|^1[0-2]$/,
    minutesSecondsRegex = /^[0-5][0-9]$|^[0-9]$/,
    meridiemRegex = /^am$|^pm$|^AM$|^PM$/,
    timeRegex = /(0[1-9]|1[0-2]):([0-5][0-9]):([0-5][0-9]) (AM|PM)/;

function propertySet(value) {
    return value >= 0 && value !== '' && value != null;
}

function intToString(value){
    var result = value.toString();
    result = result.length === 1 ? '0' + result : result;

    return result;
}


function valueChange(component) {
    if(!component.element){
        return;
    }

    if(!component.secondsEnabled()) {
        component.seconds(0);
    }

    if(!component.minutesEnabled()) {
        component.minutes(0);
    }

    var hours = component.hours(),
        minutes = component.minutes(),
        seconds = component.seconds(),
        meridiem = component.meridiem(),
        time = '';

    if(!propertySet(hours) || !propertySet(minutes) || !propertySet(seconds) || !meridiem) {
        component.valid(false);
        return;
    } else {
        component.valid(true);
        time = intToString(hours) + ':' + intToString(minutes) + ':' + intToString(seconds) + ' ' + meridiem;
    }

    component.time(time);
    component.hoursInput.value = hours;
    component.minutesInput.value = minutes;
    component.secondsInput.value = seconds;
    component.meridiemInput.value = meridiem;
}

module.exports = function(fastn, component, type, settings, children){
    component.extend('_generic', settings, children);
    component.setProperty('valid');

    component.setProperty('minutesEnabled');
    component.minutesEnabled(settings.minutesEnabled === false ? false: true);
    component.setProperty('secondsEnabled');
    component.secondsEnabled(settings.secondsEnabled === false ? false: true);

    function setInputProperty(key, input, regex){
        component.setProperty(key, fastn.property(null, function(value) {
            var validValue = regex.test(value);
            input.value = validValue ? value : '';
            if(!validValue) {
                component[key](null);
            }
            valueChange(component);
        }));
    }

    component.hoursInput = crel('input',{
        class: 'hours',
        title: 'hours',
        placeholder: 'hh'
    });

    component.minutesInput = crel('input', {
        class: 'minutes',
        title: 'minutes',
        placeholder: 'mm'
    });

    component.secondsInput = crel('input', {
        class: 'seconds',
        title: 'seconds',
        placeholder: 'ss'
    });

    component.meridiemInput = crel('select', {
            class: 'meridiem',
            title: 'meridiem'
        },
        crel('option', {value: 'AM'}, 'AM'),
        crel('option', {value: 'PM'}, 'PM')
    );

    setInputProperty('hours', component.hoursInput, hoursRegex);
    setInputProperty('minutes', component.minutesInput, minutesSecondsRegex);
    setInputProperty('seconds', component.secondsInput, minutesSecondsRegex);
    setInputProperty('meridiem', component.meridiemInput, meridiemRegex);

    component.setProperty('time', fastn.property(null, function update(time){
        if(!time){
            return;
        }

        var match = time.match(timeRegex);

        if(!match) {
            component.hours(null);
            component.minutes(null);
            component.seconds(null);
            component.meridiem(null);
        } else {
            component.hours(parseInt(match[1]));
            component.minutes(parseInt(match[2]));
            component.seconds(parseInt(match[3]));
            component.meridiem(match[4]);
        }
        valueChange(component);
    }));

    component.on('change', valueChange.bind(null, component));
    component.on('attach', valueChange.bind(null, component));

    function createSeperator() {
        return crel('span',
            {class: 'seperator'},
            ':'
        );
    }

    component.render = function() {
        component.element = crel('span', {class: 'timePicker'},
            component.hoursInput,
            component.minutesEnabled() ? createSeperator() : null,
            component.minutesEnabled() ? component.minutesInput : null,
            component.secondsEnabled() ? createSeperator() : null,
            component.secondsEnabled() ? component.secondsInput : null,
            component.meridiemInput
        );

        var docComponent = doc(component.componentElement),
            docHours = doc(component.hoursInput),
            docMinutes = doc(component.minutesInput),
            docSeconds = doc(component.secondsInput),
            docMeridiem = doc(component.meridiemInput);

        component.meridiem('AM');

        docHours.on('change', function(event) {
            component.hours(component.hoursInput.value);
        });

        docMinutes.on('change', function(event) {
            component.minutes(component.minutesInput.value);
        });

        docSeconds.on('change', function(event) {
            component.seconds(component.secondsInput.value);
        });

        docMeridiem.on('change', function(event) {
            component.meridiem(component.meridiemInput.value);
        });

        docHours.on('focus', function(event) {
            docComponent.addClass('focus');
        });

        docMinutes.on('focus', function(event) {
            docComponent.addClass('focus');
        });

        docSeconds.on('focus', function(event) {
            docComponent.addClass('focus');
        });

        docMeridiem.on('focus', function(event) {
            docComponent.addClass('focus');
        });

        docHours.on('blur', function(event) {
            docComponent.removeClass('focus');
        });

        docMinutes.on('blur', function(event) {
            docComponent.removeClass('focus');
        });

        docSeconds.on('blur', function(event) {
            docComponent.removeClass('focus');
        });

        docMeridiem.on('blur', function(event) {
            docComponent.removeClass('focus');
        });

        morrison({
            parentElement: component.element,
            validators: {
                '.timePicker .hours': /^0?[0-9]$|^[0-1][0-2]$/,
                '.timePicker .minutes': /^0?[0-9]$|^[0-5][0-9]$/,
                '.timePicker .seconds': /^0?[0-9]$|^[0-5][0-9]$/
            }
        });

        component.emit('render');
        return component;
    };

    return component;
};

module.exports.expectedComponents = ['_generic'];

},{"crel":4,"doc-js":6,"morrison":34}]},{},[93])
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy93YXRjaGlmeS9ub2RlX21vZHVsZXMvYnJvd3NlcmlmeS9ub2RlX21vZHVsZXMvYnJvd3Nlci1wYWNrL19wcmVsdWRlLmpzIiwiaW5kZXguanMiLCJub2RlX21vZHVsZXMvYXV0b21hZ2ljLXVpL2luZGV4LmpzIiwibm9kZV9tb2R1bGVzL2F1dG9tYWdpYy11aS9ub2RlX21vZHVsZXMvcHJlZGF0b3IvcHJlZGF0b3IuanMiLCJub2RlX21vZHVsZXMvY3JlbC9jcmVsLmpzIiwibm9kZV9tb2R1bGVzL2RvYy1qcy9kb2MuanMiLCJub2RlX21vZHVsZXMvZG9jLWpzL2ZsdWVudC5qcyIsIm5vZGVfbW9kdWxlcy9kb2MtanMvZ2V0VGFyZ2V0LmpzIiwibm9kZV9tb2R1bGVzL2RvYy1qcy9nZXRUYXJnZXRzLmpzIiwibm9kZV9tb2R1bGVzL2RvYy1qcy9pc0xpc3QuanMiLCJub2RlX21vZHVsZXMvZmFzdG4vYmFzZUNvbXBvbmVudC5qcyIsIm5vZGVfbW9kdWxlcy9mYXN0bi9iaW5kaW5nLmpzIiwibm9kZV9tb2R1bGVzL2Zhc3RuL2NvbnRhaW5lckNvbXBvbmVudC5qcyIsIm5vZGVfbW9kdWxlcy9mYXN0bi9mYW5jeVByb3BzLmpzIiwibm9kZV9tb2R1bGVzL2Zhc3RuL2Zpcm1lci5qcyIsIm5vZGVfbW9kdWxlcy9mYXN0bi9mdW5jdGlvbkVtaXR0ZXIuanMiLCJub2RlX21vZHVsZXMvZmFzdG4vZ2VuZXJpY0NvbXBvbmVudC5qcyIsIm5vZGVfbW9kdWxlcy9mYXN0bi9pbmRleC5qcyIsIm5vZGVfbW9kdWxlcy9mYXN0bi9pcy5qcyIsIm5vZGVfbW9kdWxlcy9mYXN0bi9ub2RlX21vZHVsZXMvY2xhc3Npc3QvaW5kZXguanMiLCJub2RlX21vZHVsZXMvZmFzdG4vbm9kZV9tb2R1bGVzL2VudGkvaW5kZXguanMiLCJub2RlX21vZHVsZXMvZmFzdG4vbm9kZV9tb2R1bGVzL29iamVjdC1hc3NpZ24vaW5kZXguanMiLCJub2RlX21vZHVsZXMvZmFzdG4vbm9kZV9tb2R1bGVzL3NhbWUtdmFsdWUvaW5kZXguanMiLCJub2RlX21vZHVsZXMvZmFzdG4vbm9kZV9tb2R1bGVzL3NldGlmeS9pbmRleC5qcyIsIm5vZGVfbW9kdWxlcy9mYXN0bi9ub2RlX21vZHVsZXMvc2V0aWZ5L25vZGVfbW9kdWxlcy9uYXR1cmFsLXNlbGVjdGlvbi9pbmRleC5qcyIsIm5vZGVfbW9kdWxlcy9mYXN0bi9ub2RlX21vZHVsZXMvc2V0cHJvdG90eXBlb2YvaW5kZXguanMiLCJub2RlX21vZHVsZXMvZmFzdG4vbm9kZV9tb2R1bGVzL3doYXQtY2hhbmdlZC9pbmRleC5qcyIsIm5vZGVfbW9kdWxlcy9mYXN0bi9ub2RlX21vZHVsZXMvd2hhdC1jaGFuZ2VkL25vZGVfbW9kdWxlcy9jbG9uZS9jbG9uZS5qcyIsIm5vZGVfbW9kdWxlcy9mYXN0bi9ub2RlX21vZHVsZXMvd2hhdC1jaGFuZ2VkL25vZGVfbW9kdWxlcy9kZWVwLWVxdWFsL2luZGV4LmpzIiwibm9kZV9tb2R1bGVzL2Zhc3RuL25vZGVfbW9kdWxlcy93aGF0LWNoYW5nZWQvbm9kZV9tb2R1bGVzL2RlZXAtZXF1YWwvbGliL2lzX2FyZ3VtZW50cy5qcyIsIm5vZGVfbW9kdWxlcy9mYXN0bi9ub2RlX21vZHVsZXMvd2hhdC1jaGFuZ2VkL25vZGVfbW9kdWxlcy9kZWVwLWVxdWFsL2xpYi9rZXlzLmpzIiwibm9kZV9tb2R1bGVzL2Zhc3RuL3Byb3BlcnR5LmpzIiwibm9kZV9tb2R1bGVzL2Zhc3RuL3NjaGVkdWxlLmpzIiwibm9kZV9tb2R1bGVzL2Zhc3RuL3RleHRDb21wb25lbnQuanMiLCJub2RlX21vZHVsZXMvbW9ycmlzb24vaW5kZXguanMiLCJub2RlX21vZHVsZXMvdGFwZS9pbmRleC5qcyIsIm5vZGVfbW9kdWxlcy90YXBlL2xpYi9kZWZhdWx0X3N0cmVhbS5qcyIsIm5vZGVfbW9kdWxlcy90YXBlL2xpYi9yZXN1bHRzLmpzIiwibm9kZV9tb2R1bGVzL3RhcGUvbGliL3Rlc3QuanMiLCJub2RlX21vZHVsZXMvdGFwZS9ub2RlX21vZHVsZXMvZGVlcC1lcXVhbC9pbmRleC5qcyIsIm5vZGVfbW9kdWxlcy90YXBlL25vZGVfbW9kdWxlcy9kZWZpbmVkL2luZGV4LmpzIiwibm9kZV9tb2R1bGVzL3RhcGUvbm9kZV9tb2R1bGVzL2Z1bmN0aW9uLWJpbmQvaW5kZXguanMiLCJub2RlX21vZHVsZXMvdGFwZS9ub2RlX21vZHVsZXMvaGFzL3NyYy9pbmRleC5qcyIsIm5vZGVfbW9kdWxlcy90YXBlL25vZGVfbW9kdWxlcy9pbmhlcml0cy9pbmhlcml0c19icm93c2VyLmpzIiwibm9kZV9tb2R1bGVzL3RhcGUvbm9kZV9tb2R1bGVzL29iamVjdC1pbnNwZWN0L2luZGV4LmpzIiwibm9kZV9tb2R1bGVzL3RhcGUvbm9kZV9tb2R1bGVzL3Jlc3VtZXIvaW5kZXguanMiLCJub2RlX21vZHVsZXMvdGFwZS9ub2RlX21vZHVsZXMvc3RyaW5nLnByb3RvdHlwZS50cmltL2ltcGxlbWVudGF0aW9uLmpzIiwibm9kZV9tb2R1bGVzL3RhcGUvbm9kZV9tb2R1bGVzL3N0cmluZy5wcm90b3R5cGUudHJpbS9pbmRleC5qcyIsIm5vZGVfbW9kdWxlcy90YXBlL25vZGVfbW9kdWxlcy9zdHJpbmcucHJvdG90eXBlLnRyaW0vbm9kZV9tb2R1bGVzL2RlZmluZS1wcm9wZXJ0aWVzL2luZGV4LmpzIiwibm9kZV9tb2R1bGVzL3RhcGUvbm9kZV9tb2R1bGVzL3N0cmluZy5wcm90b3R5cGUudHJpbS9ub2RlX21vZHVsZXMvZGVmaW5lLXByb3BlcnRpZXMvbm9kZV9tb2R1bGVzL2ZvcmVhY2gvaW5kZXguanMiLCJub2RlX21vZHVsZXMvdGFwZS9ub2RlX21vZHVsZXMvc3RyaW5nLnByb3RvdHlwZS50cmltL25vZGVfbW9kdWxlcy9kZWZpbmUtcHJvcGVydGllcy9ub2RlX21vZHVsZXMvb2JqZWN0LWtleXMvaW5kZXguanMiLCJub2RlX21vZHVsZXMvdGFwZS9ub2RlX21vZHVsZXMvc3RyaW5nLnByb3RvdHlwZS50cmltL25vZGVfbW9kdWxlcy9kZWZpbmUtcHJvcGVydGllcy9ub2RlX21vZHVsZXMvb2JqZWN0LWtleXMvaXNBcmd1bWVudHMuanMiLCJub2RlX21vZHVsZXMvdGFwZS9ub2RlX21vZHVsZXMvc3RyaW5nLnByb3RvdHlwZS50cmltL25vZGVfbW9kdWxlcy9lcy1hYnN0cmFjdC9lczUuanMiLCJub2RlX21vZHVsZXMvdGFwZS9ub2RlX21vZHVsZXMvc3RyaW5nLnByb3RvdHlwZS50cmltL25vZGVfbW9kdWxlcy9lcy1hYnN0cmFjdC9oZWxwZXJzL2lzRmluaXRlLmpzIiwibm9kZV9tb2R1bGVzL3RhcGUvbm9kZV9tb2R1bGVzL3N0cmluZy5wcm90b3R5cGUudHJpbS9ub2RlX21vZHVsZXMvZXMtYWJzdHJhY3QvaGVscGVycy9tb2QuanMiLCJub2RlX21vZHVsZXMvdGFwZS9ub2RlX21vZHVsZXMvc3RyaW5nLnByb3RvdHlwZS50cmltL25vZGVfbW9kdWxlcy9lcy1hYnN0cmFjdC9oZWxwZXJzL3NpZ24uanMiLCJub2RlX21vZHVsZXMvdGFwZS9ub2RlX21vZHVsZXMvc3RyaW5nLnByb3RvdHlwZS50cmltL25vZGVfbW9kdWxlcy9lcy1hYnN0cmFjdC9ub2RlX21vZHVsZXMvZXMtdG8tcHJpbWl0aXZlL2VzNS5qcyIsIm5vZGVfbW9kdWxlcy90YXBlL25vZGVfbW9kdWxlcy9zdHJpbmcucHJvdG90eXBlLnRyaW0vbm9kZV9tb2R1bGVzL2VzLWFic3RyYWN0L25vZGVfbW9kdWxlcy9lcy10by1wcmltaXRpdmUvaGVscGVycy9pc1ByaW1pdGl2ZS5qcyIsIm5vZGVfbW9kdWxlcy90YXBlL25vZGVfbW9kdWxlcy9zdHJpbmcucHJvdG90eXBlLnRyaW0vbm9kZV9tb2R1bGVzL2VzLWFic3RyYWN0L25vZGVfbW9kdWxlcy9pcy1jYWxsYWJsZS9pbmRleC5qcyIsIm5vZGVfbW9kdWxlcy90YXBlL25vZGVfbW9kdWxlcy9zdHJpbmcucHJvdG90eXBlLnRyaW0vcG9seWZpbGwuanMiLCJub2RlX21vZHVsZXMvdGFwZS9ub2RlX21vZHVsZXMvc3RyaW5nLnByb3RvdHlwZS50cmltL3NoaW0uanMiLCJub2RlX21vZHVsZXMvdGFwZS9ub2RlX21vZHVsZXMvdGhyb3VnaC9pbmRleC5qcyIsIm5vZGVfbW9kdWxlcy93YXRjaGlmeS9ub2RlX21vZHVsZXMvYnJvd3NlcmlmeS9saWIvX2VtcHR5LmpzIiwibm9kZV9tb2R1bGVzL3dhdGNoaWZ5L25vZGVfbW9kdWxlcy9icm93c2VyaWZ5L25vZGVfbW9kdWxlcy9idWZmZXIvaW5kZXguanMiLCJub2RlX21vZHVsZXMvd2F0Y2hpZnkvbm9kZV9tb2R1bGVzL2Jyb3dzZXJpZnkvbm9kZV9tb2R1bGVzL2J1ZmZlci9ub2RlX21vZHVsZXMvYmFzZTY0LWpzL2xpYi9iNjQuanMiLCJub2RlX21vZHVsZXMvd2F0Y2hpZnkvbm9kZV9tb2R1bGVzL2Jyb3dzZXJpZnkvbm9kZV9tb2R1bGVzL2J1ZmZlci9ub2RlX21vZHVsZXMvaWVlZTc1NC9pbmRleC5qcyIsIm5vZGVfbW9kdWxlcy93YXRjaGlmeS9ub2RlX21vZHVsZXMvYnJvd3NlcmlmeS9ub2RlX21vZHVsZXMvYnVmZmVyL25vZGVfbW9kdWxlcy9pc2FycmF5L2luZGV4LmpzIiwibm9kZV9tb2R1bGVzL3dhdGNoaWZ5L25vZGVfbW9kdWxlcy9icm93c2VyaWZ5L25vZGVfbW9kdWxlcy9ldmVudHMvZXZlbnRzLmpzIiwibm9kZV9tb2R1bGVzL3dhdGNoaWZ5L25vZGVfbW9kdWxlcy9icm93c2VyaWZ5L25vZGVfbW9kdWxlcy9pbnNlcnQtbW9kdWxlLWdsb2JhbHMvbm9kZV9tb2R1bGVzL2lzLWJ1ZmZlci9pbmRleC5qcyIsIm5vZGVfbW9kdWxlcy93YXRjaGlmeS9ub2RlX21vZHVsZXMvYnJvd3NlcmlmeS9ub2RlX21vZHVsZXMvaXNhcnJheS9pbmRleC5qcyIsIm5vZGVfbW9kdWxlcy93YXRjaGlmeS9ub2RlX21vZHVsZXMvYnJvd3NlcmlmeS9ub2RlX21vZHVsZXMvcGF0aC1icm93c2VyaWZ5L2luZGV4LmpzIiwibm9kZV9tb2R1bGVzL3dhdGNoaWZ5L25vZGVfbW9kdWxlcy9icm93c2VyaWZ5L25vZGVfbW9kdWxlcy9wcm9jZXNzL2Jyb3dzZXIuanMiLCJub2RlX21vZHVsZXMvd2F0Y2hpZnkvbm9kZV9tb2R1bGVzL2Jyb3dzZXJpZnkvbm9kZV9tb2R1bGVzL3JlYWRhYmxlLXN0cmVhbS9kdXBsZXguanMiLCJub2RlX21vZHVsZXMvd2F0Y2hpZnkvbm9kZV9tb2R1bGVzL2Jyb3dzZXJpZnkvbm9kZV9tb2R1bGVzL3JlYWRhYmxlLXN0cmVhbS9saWIvX3N0cmVhbV9kdXBsZXguanMiLCJub2RlX21vZHVsZXMvd2F0Y2hpZnkvbm9kZV9tb2R1bGVzL2Jyb3dzZXJpZnkvbm9kZV9tb2R1bGVzL3JlYWRhYmxlLXN0cmVhbS9saWIvX3N0cmVhbV9wYXNzdGhyb3VnaC5qcyIsIm5vZGVfbW9kdWxlcy93YXRjaGlmeS9ub2RlX21vZHVsZXMvYnJvd3NlcmlmeS9ub2RlX21vZHVsZXMvcmVhZGFibGUtc3RyZWFtL2xpYi9fc3RyZWFtX3JlYWRhYmxlLmpzIiwibm9kZV9tb2R1bGVzL3dhdGNoaWZ5L25vZGVfbW9kdWxlcy9icm93c2VyaWZ5L25vZGVfbW9kdWxlcy9yZWFkYWJsZS1zdHJlYW0vbGliL19zdHJlYW1fdHJhbnNmb3JtLmpzIiwibm9kZV9tb2R1bGVzL3dhdGNoaWZ5L25vZGVfbW9kdWxlcy9icm93c2VyaWZ5L25vZGVfbW9kdWxlcy9yZWFkYWJsZS1zdHJlYW0vbGliL19zdHJlYW1fd3JpdGFibGUuanMiLCJub2RlX21vZHVsZXMvd2F0Y2hpZnkvbm9kZV9tb2R1bGVzL2Jyb3dzZXJpZnkvbm9kZV9tb2R1bGVzL3JlYWRhYmxlLXN0cmVhbS9ub2RlX21vZHVsZXMvY29yZS11dGlsLWlzL2xpYi91dGlsLmpzIiwibm9kZV9tb2R1bGVzL3dhdGNoaWZ5L25vZGVfbW9kdWxlcy9icm93c2VyaWZ5L25vZGVfbW9kdWxlcy9yZWFkYWJsZS1zdHJlYW0vbm9kZV9tb2R1bGVzL3Byb2Nlc3MtbmV4dGljay1hcmdzL2luZGV4LmpzIiwibm9kZV9tb2R1bGVzL3dhdGNoaWZ5L25vZGVfbW9kdWxlcy9icm93c2VyaWZ5L25vZGVfbW9kdWxlcy9yZWFkYWJsZS1zdHJlYW0vbm9kZV9tb2R1bGVzL3V0aWwtZGVwcmVjYXRlL2Jyb3dzZXIuanMiLCJub2RlX21vZHVsZXMvd2F0Y2hpZnkvbm9kZV9tb2R1bGVzL2Jyb3dzZXJpZnkvbm9kZV9tb2R1bGVzL3JlYWRhYmxlLXN0cmVhbS9wYXNzdGhyb3VnaC5qcyIsIm5vZGVfbW9kdWxlcy93YXRjaGlmeS9ub2RlX21vZHVsZXMvYnJvd3NlcmlmeS9ub2RlX21vZHVsZXMvcmVhZGFibGUtc3RyZWFtL3JlYWRhYmxlLmpzIiwibm9kZV9tb2R1bGVzL3dhdGNoaWZ5L25vZGVfbW9kdWxlcy9icm93c2VyaWZ5L25vZGVfbW9kdWxlcy9yZWFkYWJsZS1zdHJlYW0vdHJhbnNmb3JtLmpzIiwibm9kZV9tb2R1bGVzL3dhdGNoaWZ5L25vZGVfbW9kdWxlcy9icm93c2VyaWZ5L25vZGVfbW9kdWxlcy9yZWFkYWJsZS1zdHJlYW0vd3JpdGFibGUuanMiLCJub2RlX21vZHVsZXMvd2F0Y2hpZnkvbm9kZV9tb2R1bGVzL2Jyb3dzZXJpZnkvbm9kZV9tb2R1bGVzL3N0cmVhbS1icm93c2VyaWZ5L2luZGV4LmpzIiwibm9kZV9tb2R1bGVzL3dhdGNoaWZ5L25vZGVfbW9kdWxlcy9icm93c2VyaWZ5L25vZGVfbW9kdWxlcy9zdHJpbmdfZGVjb2Rlci9pbmRleC5qcyIsInRlc3RzL3VpIiwidGltZVBpY2tlci5qcyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTtBQ0FBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ1RBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3RTQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNsRUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDNUpBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3prQkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ25GQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ2JBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3hCQTtBQUNBO0FBQ0E7O0FDRkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDM05BO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUN6T0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUMzSUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDaEdBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNMQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ1BBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUMvTEE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDcElBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ2pDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOzs7QUM5Q0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7Ozs7QUMzbEJBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3ZDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDZEE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDZkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ0xBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNYQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOzs7QUNyRkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7OztBQ2hLQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzlGQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDcEJBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ1RBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQy9NQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ2xDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzlDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7Ozs7Ozs7QUNyR0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7Ozs7O0FDdEpBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7Ozs7O0FDL0JBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7Ozs7O0FDM0xBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7OztBQzllQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOzs7Ozs7QUM5RkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ0xBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ2hEQTtBQUNBO0FBQ0E7QUFDQTs7QUNIQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDdkJBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOzs7QUNuSkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOzs7O0FDN0JBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDYkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDbEJBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUN4REE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUN0QkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ2hJQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDakJBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDaEVBO0FBQ0E7QUFDQTtBQUNBOztBQ0hBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDSkE7QUFDQTtBQUNBO0FBQ0E7O0FDSEE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNyQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDSEE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDdkNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ1pBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7OztBQ1ZBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOzs7O0FDNUdBOzs7OztBQ0FBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7OztBQzk2Q0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUN0SEE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDcEZBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNMQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOzs7O0FDMVNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNqQkE7QUFDQTtBQUNBO0FBQ0E7OztBQ0hBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7OztBQ2hPQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzNGQTtBQUNBOztBQ0RBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDbEZBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOzs7QUMzQkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7Ozs7QUMvOEJBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNyTUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7O0FDamhCQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7Ozs7O0FDM0dBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7Ozs7QUNwQkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7OztBQ25FQTtBQUNBOztBQ0RBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ1pBO0FBQ0E7O0FDREE7QUFDQTs7QUNEQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQy9IQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDN05BO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDN0RBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBIiwiZmlsZSI6ImdlbmVyYXRlZC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzQ29udGVudCI6WyIoZnVuY3Rpb24gZSh0LG4scil7ZnVuY3Rpb24gcyhvLHUpe2lmKCFuW29dKXtpZighdFtvXSl7dmFyIGE9dHlwZW9mIHJlcXVpcmU9PVwiZnVuY3Rpb25cIiYmcmVxdWlyZTtpZighdSYmYSlyZXR1cm4gYShvLCEwKTtpZihpKXJldHVybiBpKG8sITApO3ZhciBmPW5ldyBFcnJvcihcIkNhbm5vdCBmaW5kIG1vZHVsZSAnXCIrbytcIidcIik7dGhyb3cgZi5jb2RlPVwiTU9EVUxFX05PVF9GT1VORFwiLGZ9dmFyIGw9bltvXT17ZXhwb3J0czp7fX07dFtvXVswXS5jYWxsKGwuZXhwb3J0cyxmdW5jdGlvbihlKXt2YXIgbj10W29dWzFdW2VdO3JldHVybiBzKG4/bjplKX0sbCxsLmV4cG9ydHMsZSx0LG4scil9cmV0dXJuIG5bb10uZXhwb3J0c312YXIgaT10eXBlb2YgcmVxdWlyZT09XCJmdW5jdGlvblwiJiZyZXF1aXJlO2Zvcih2YXIgbz0wO288ci5sZW5ndGg7bysrKXMocltvXSk7cmV0dXJuIHN9KSIsInZhciBmYXN0biA9IHJlcXVpcmUoJ2Zhc3RuJykoe1xuICAgIF9nZW5lcmljOiByZXF1aXJlKCdmYXN0bi9nZW5lcmljQ29tcG9uZW50JyksXG4gICAgdGV4dDogcmVxdWlyZSgnZmFzdG4vdGV4dENvbXBvbmVudCcpLFxuICAgIHRpbWVQaWNrZXI6IHJlcXVpcmUoJy4vdGltZVBpY2tlcicpXG59KTtcblxubW9kdWxlLmV4cG9ydHMgPSBmdW5jdGlvbihzZXR0aW5ncykge1xuICAgIHJldHVybiBmYXN0bigndGltZVBpY2tlcicsIHNldHRpbmdzKS5hdHRhY2goKS5yZW5kZXIoKTtcbn07XG4iLCJ2YXIgcHJlZGF0b3IgPSByZXF1aXJlKCdwcmVkYXRvcicpO1xuXG4vLyBMaXN0IG9mIHRhZ05hbWVzIG9yZGVyZWQgYnkgdGhlaXIgbGlrZWxpbmVzcyB0byBiZSB0aGUgdGFyZ2V0IG9mIGEgY2xpY2sgZXZlbnRcbnZhciBjbGlja2FibGVXZWlnaHRpbmcgPSBbJ2J1dHRvbicsICdhJywgJ2xhYmVsJywgJ2gxJywgJ2gyJywgJ2gzJywgJ2g0JywgJ2knLCAnc3BhbiddO1xuXG52YXIgdHlwZXMgPSB7XG4gICAgICAgICdidXR0b24nOiBbJ2J1dHRvbicsICdhJ10sXG4gICAgICAgICdsYWJlbCc6IFsnbGFiZWwnLCAnc3BhbicsICdkaXYnXSxcbiAgICAgICAgJ2hlYWRpbmcnOiBbJ2gxJywgJ2gyJywgJ2gzJywgJ2g0J10sXG4gICAgICAgICdpbWFnZSc6IFsnaW1nJywgJ3N2ZyddLFxuICAgICAgICAnZmllbGQnOiBbJ2lucHV0JywgJ3NlbGVjdCddLFxuICAgICAgICAnYWxsJzogWycqJ11cbiAgICB9LFxuICAgIG5vZWxlbWVudE9mVHlwZSA9ICdubyBlbGVtZW50cyBvZiB0eXBlICcsXG4gICAgZG9jdW1lbnRTY29wZSxcbiAgICB3aW5kb3dTY29wZSxcbiAgICBydW5EZWxheSxcbiAgICBpbml0aWFsaXNlZDtcblxuZnVuY3Rpb24gX3ByZXNzS2V5KGtleSwgZG9uZSkge1xuICAgIHZhciBlbGVtZW50ID0gZG9jdW1lbnRTY29wZS5hY3RpdmVFbGVtZW50O1xuXG4gICAgZWxlbWVudC52YWx1ZSArPSBrZXk7XG5cbiAgICB2YXIga2V5ZG93bkV2ZW50ID0gbmV3IHdpbmRvd1Njb3BlLktleWJvYXJkRXZlbnQoJ2tleWRvd24nKSxcbiAgICAgICAga2V5dXBFdmVudCA9IG5ldyB3aW5kb3dTY29wZS5LZXlib2FyZEV2ZW50KCdrZXl1cCcpLFxuICAgICAgICBwcmVzc0tleUV2ZW50ID0gbmV3IHdpbmRvd1Njb3BlLktleWJvYXJkRXZlbnQoJ3ByZXNzS2V5Jyk7XG5cbiAgICB2YXIgbWV0aG9kID0gJ2luaXRLZXlib2FyZEV2ZW50JyBpbiBrZXlkb3duRXZlbnQgPyAnaW5pdEtleWJvYXJkRXZlbnQnIDogJ2luaXRLZXlFdmVudCc7XG5cbiAgICBrZXlkb3duRXZlbnRbbWV0aG9kXSgna2V5ZG93bicsIHRydWUsIHRydWUsIHdpbmRvd1Njb3BlLCBrZXksIDMsIHRydWUsIGZhbHNlLCB0cnVlLCBmYWxzZSwgZmFsc2UpO1xuICAgIGtleXVwRXZlbnRbbWV0aG9kXSgna2V5dXAnLCB0cnVlLCB0cnVlLCB3aW5kb3dTY29wZSwga2V5LCAzLCB0cnVlLCBmYWxzZSwgdHJ1ZSwgZmFsc2UsIGZhbHNlKTtcbiAgICBwcmVzc0tleUV2ZW50W21ldGhvZF0oJ3ByZXNzS2V5JywgdHJ1ZSwgdHJ1ZSwgd2luZG93U2NvcGUsIGtleSwgMywgdHJ1ZSwgZmFsc2UsIHRydWUsIGZhbHNlLCBmYWxzZSk7XG5cbiAgICBlbGVtZW50LmRpc3BhdGNoRXZlbnQoa2V5ZG93bkV2ZW50KTtcbiAgICBlbGVtZW50LmRpc3BhdGNoRXZlbnQoa2V5dXBFdmVudCk7XG4gICAgZWxlbWVudC5kaXNwYXRjaEV2ZW50KHByZXNzS2V5RXZlbnQpO1xuXG4gICAgZG9uZShudWxsLCBlbGVtZW50KTtcbn1cblxuZnVuY3Rpb24gX3ByZXNzS2V5cyhrZXlzLCBkb25lKSB7XG4gICAga2V5cy5zcGxpdCgnJykuZm9yRWFjaChmdW5jdGlvbihrZXkpIHtcbiAgICAgICAgX3ByZXNzS2V5KGtleSwgZnVuY3Rpb24gbm9vcCgpIHt9KTtcbiAgICB9KTtcblxuICAgIGRvbmUobnVsbCwgZG9jdW1lbnRTY29wZS5hY3RpdmVFbGVtZW50KTtcbn1cblxuZnVuY3Rpb24gZmluZFVpKHNlbGVjdG9ycykge1xuICAgIHJldHVybiBkb2N1bWVudFNjb3BlLnF1ZXJ5U2VsZWN0b3JBbGwoc2VsZWN0b3JzKTtcbn1cblxuZnVuY3Rpb24gX25hdmlnYXRlKGxvY2F0aW9uLCBwcmV2aW91c0VsZW1lbnQsIGRvbmUpIHtcbiAgICB2YXIgY2FsbGJhY2tUaW1lcjtcblxuICAgIGZ1bmN0aW9uIGhhbmRsZXdpbmRvd1Njb3BlRXJyb3IoZXJyb3IpIHtcbiAgICAgICAgY2xlYXJUaW1lb3V0KGNhbGxiYWNrVGltZXIpO1xuXG4gICAgICAgIGRvbmUoZXJyb3IpO1xuICAgICAgICB3aW5kb3dTY29wZS5yZW1vdmVFdmVudExpc3RlbmVyKCdlcnJvcicsIGhhbmRsZXdpbmRvd1Njb3BlRXJyb3IpO1xuICAgIH1cblxuICAgIHdpbmRvd1Njb3BlLmFkZEV2ZW50TGlzdGVuZXIoJ2Vycm9yJywgaGFuZGxld2luZG93U2NvcGVFcnJvcik7XG4gICAgd2luZG93U2NvcGUubG9jYXRpb24gPSBsb2NhdGlvbjtcblxuICAgIGNhbGxiYWNrVGltZXIgPSBzZXRUaW1lb3V0KGRvbmUsIDE1MCk7XG59XG5cbmZ1bmN0aW9uIF9nZXRMb2NhdGlvbihkb25lKSB7XG4gICAgc2V0VGltZW91dChmdW5jdGlvbigpIHtcbiAgICAgICAgZG9uZShudWxsLCB3aW5kb3dTY29wZS5sb2NhdGlvbik7XG4gICAgfSwgNTAwKTtcbn1cblxuZnVuY3Rpb24gbWF0Y2hFbGVtZW50VmFsdWUoZWxlbWVudCwgdmFsdWUpIHtcbiAgICByZXR1cm4gKFxuICAgICAgICAgICAgZWxlbWVudC50ZXh0Q29udGVudC50b0xvd2VyQ2FzZSgpID09PSB2YWx1ZS50b0xvd2VyQ2FzZSgpIHx8XG4gICAgICAgICAgICAoZWxlbWVudC50aXRsZSAmJiBlbGVtZW50LnRpdGxlLnRvTG93ZXJDYXNlKCkgPT09IHZhbHVlLnRvTG93ZXJDYXNlKCkpXG4gICAgICAgICkgJiYgIXByZWRhdG9yKGVsZW1lbnQpLmhpZGRlbjtcbn1cblxuZnVuY3Rpb24gZmluZE1hdGNoaW5nRWxlbWVudHModmFsdWUsIHR5cGUsIGVsZW1lbnRzTGlzdCkge1xuICAgIHJldHVybiBBcnJheS5wcm90b3R5cGUuc2xpY2UuY2FsbChlbGVtZW50c0xpc3QpXG4gICAgICAgIC5maWx0ZXIoZnVuY3Rpb24oZWxlbWVudCkge1xuICAgICAgICAgICAgcmV0dXJuIG1hdGNoRWxlbWVudFZhbHVlKGVsZW1lbnQsIHZhbHVlKTtcbiAgICAgICAgfSk7XG59XG5cbmZ1bmN0aW9uIF9maW5kVWkodmFsdWUsIHR5cGUsIHJldHVybkFycmF5LCBkb25lKSB7XG4gICAgaWYoIWRvbmUpIHtcbiAgICAgICAgZG9uZSA9IHJldHVybkFycmF5O1xuICAgICAgICByZXR1cm5BcnJheSA9IGZhbHNlO1xuICAgIH1cblxuICAgIHZhciBlbGVtZW50VHlwZXMgPSB0eXBlc1t0eXBlXTtcblxuICAgIGlmKCFlbGVtZW50VHlwZXMpIHtcbiAgICAgICAgcmV0dXJuIGRvbmUobmV3IEVycm9yKHR5cGUgKyAnIGlzIG5vdCBhIHZhbGlkIHVpIHR5cGUnKSk7XG4gICAgfVxuXG4gICAgdmFyIGVsZW1lbnRzID0gZmluZFVpKGVsZW1lbnRUeXBlcyk7XG5cbiAgICBpZighZWxlbWVudHMubGVuZ3RoKSB7XG4gICAgICAgIHJldHVybiBkb25lKG5ldyBFcnJvcihub2VsZW1lbnRPZlR5cGUgKyB0eXBlKSk7XG4gICAgfVxuXG4gICAgdmFyIHJlc3VsdCA9IGZpbmRNYXRjaGluZ0VsZW1lbnRzKHZhbHVlLCB0eXBlLCBlbGVtZW50cyk7XG5cbiAgICBpZighcmVzdWx0Lmxlbmd0aCkge1xuICAgICAgICByZXR1cm4gZG9uZShuZXcgRXJyb3Iobm9lbGVtZW50T2ZUeXBlICsgdHlwZSArICcgd2l0aCB2YWx1ZSBvZiAnICsgdmFsdWUpKTtcbiAgICB9XG5cbiAgICBkb25lKG51bGwsIHJldHVybkFycmF5ID8gcmVzdWx0IDogcmVzdWx0LnNoaWZ0KCkpO1xufVxuXG5mdW5jdGlvbiBfc2V0VmFsdWUodmFsdWUsIGVsZW1lbnQsIGRvbmUpIHtcbiAgICBlbGVtZW50LnZhbHVlID0gdmFsdWU7XG5cbiAgICBkb25lKG51bGwsIGVsZW1lbnQpO1xufVxuXG5mdW5jdGlvbiBfd2FpdCh0aW1lLCBkb25lKSB7XG4gICAgc2V0VGltZW91dChkb25lLCB0aW1lIHx8IDApO1xufVxuXG5mdW5jdGlvbiBfY2xpY2soZWxlbWVudCwgZG9uZSkge1xuICAgIHZhciByZWN0ID0gZWxlbWVudC5nZXRCb3VuZGluZ0NsaWVudFJlY3QoKSxcbiAgICAgICAgY2xpY2tFbGVtZW50ID0gZG9jdW1lbnRTY29wZS5lbGVtZW50RnJvbVBvaW50KHJlY3QubGVmdCwgcmVjdC50b3ApLFxuICAgICAgICBlbGVtZW50SW5DbGlja0VsZW1lbnQgPSB+QXJyYXkucHJvdG90eXBlLmluZGV4T2YuY2FsbChjbGlja0VsZW1lbnQuY2hpbGRyZW4sIGVsZW1lbnQpO1xuICAgIGlmXG4gICAgKCFlbGVtZW50SW5DbGlja0VsZW1lbnQgJiYgKGNsaWNrRWxlbWVudCAhPT0gZWxlbWVudCkpIHtcbiAgICAgICAgcmV0dXJuIGRvbmUobmV3IEVycm9yKCdubyBjbGlja2FibGUgZWxlbWVudCBmb3VuZCcpKTtcbiAgICB9XG5cbiAgICBlbGVtZW50LmNsaWNrKCk7XG5cbiAgICBkb25lKG51bGwsIGVsZW1lbnQpO1xufVxuXG5mdW5jdGlvbiBnZXRFbGVtZW50Q2xpY2tXZWlnaHQoZWxlbWVudCkge1xuICAgIHZhciBpbmRleCA9IGNsaWNrYWJsZVdlaWdodGluZy5pbmRleE9mKGVsZW1lbnQudGFnTmFtZS50b0xvd2VyQ2FzZSgpKTtcbiAgICByZXR1cm4gY2xpY2thYmxlV2VpZ2h0aW5nLmxlbmd0aCAtIChpbmRleCA8IDAgPyBJbmZpbml0eSA6IGluZGV4KTtcbn1cblxuZnVuY3Rpb24gZXhlY3V0ZUNsaWNrKHZhbHVlLCB0eXBlLCBkb25lKSB7XG4gICAgX2ZpbmRVaSh2YWx1ZSwgJ2FsbCcsIHRydWUsIGZ1bmN0aW9uKGVycm9yLCBlbGVtZW50cykge1xuICAgICAgICBpZihlcnJvcikge1xuICAgICAgICAgICAgcmV0dXJuIGRvbmUoZXJyb3IpO1xuICAgICAgICB9XG5cbiAgICAgICAgdmFyIGVsZW1lbnQgPSBlbGVtZW50cy5zb3J0KGZ1bmN0aW9uKGEsIGIpIHtcbiAgICAgICAgICAgIHJldHVybiBnZXRFbGVtZW50Q2xpY2tXZWlnaHQoYSkgPCBnZXRFbGVtZW50Q2xpY2tXZWlnaHQoYik7XG4gICAgICAgIH0pLnNoaWZ0KCk7XG5cbiAgICAgICAgaWYoIWVsZW1lbnQpIHtcbiAgICAgICAgICAgIHJldHVybiBkb25lKG5ldyBFcnJvcignY291bGQgbm90IGZpbmQgY2xpY2thYmxlIGVsZW1lbnQgd2l0aCB2YWx1ZSAnICsgdmFsdWUpKTtcbiAgICAgICAgfVxuXG4gICAgICAgIF9jbGljayhlbGVtZW50LCBkb25lKTtcbiAgICB9KTtcbn1cblxuZnVuY3Rpb24gX2ZvY3VzKGVsZW1lbnQsIGRvbmUpIHtcbiAgICBlbGVtZW50LmZvY3VzKCk7XG5cbiAgICBkb25lKG51bGwsIGVsZW1lbnQpO1xufVxuXG5mdW5jdGlvbiBfY2hhbmdlVmFsdWUoc2VsZWN0b3IsIHR5cGUsIHZhbHVlLCBkb25lKSB7XG4gICAgZXhlY3V0ZShfZm9jdXMsIHNlbGVjdG9yLCB0eXBlLCBmdW5jdGlvbihlcnJvciwgZWxlbWVudCkge1xuICAgICAgICBfcHJlc3NLZXlzKHZhbHVlLCBmdW5jdGlvbihlcnJvcil7XG4gICAgICAgICAgICBlbGVtZW50LmJsdXIoKTtcblxuICAgICAgICAgICAgdmFyIGV2ZW50ID0gZG9jdW1lbnQuY3JlYXRlRXZlbnQoJ0hUTUxFdmVudHMnKTtcblxuICAgICAgICAgICAgZXZlbnQuaW5pdEV2ZW50KCdjaGFuZ2UnLCBmYWxzZSwgdHJ1ZSk7XG4gICAgICAgICAgICBlbGVtZW50LmRpc3BhdGNoRXZlbnQoZXZlbnQpO1xuXG4gICAgICAgICAgICBkb25lKG51bGwsIGVsZW1lbnQpO1xuICAgICAgICB9KTtcbiAgICB9KTtcbn1cblxuZnVuY3Rpb24gX2JsdXIoZG9uZSkge1xuICAgIHZhciBlbGVtZW50ID0gZG9jdW1lbnRTY29wZS5hY3RpdmVFbGVtZW50O1xuICAgIGVsZW1lbnQuYmx1cigpO1xuXG4gICAgZG9uZShudWxsLCBlbGVtZW50KTtcbn1cblxuZnVuY3Rpb24gZXhlY3V0ZSh0YXNrLCB2YWx1ZSwgdHlwZSwgZG9uZSkge1xuICAgIF9maW5kVWkodmFsdWUsIHR5cGUsIGZ1bmN0aW9uKGVycm9yLCBlbGVtZW50KSB7XG4gICAgICAgIGlmKGVycm9yKSB7XG4gICAgICAgICAgICByZXR1cm4gZG9uZShlcnJvcik7XG4gICAgICAgIH1cblxuICAgICAgICB0YXNrKGVsZW1lbnQsIGRvbmUpO1xuICAgIH0pO1xufVxuXG5mdW5jdGlvbiBydW5UYXNrcyh0YXNrcywgY2FsbGJhY2spIHtcbiAgICBpZih0YXNrcy5sZW5ndGgpIHtcbiAgICAgICAgdGFza3Muc2hpZnQoKShmdW5jdGlvbihlcnJvciwgcmVzdWx0KSB7XG4gICAgICAgICAgICBpZihlcnJvcikge1xuICAgICAgICAgICAgICAgIHJldHVybiBjYWxsYmFjayhlcnJvcik7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIGlmKHRhc2tzLmxlbmd0aCA9PT0gMCkge1xuICAgICAgICAgICAgICAgICAgICBjYWxsYmFjayhudWxsLCByZXN1bHQpO1xuICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgIHJ1blRhc2tzKHRhc2tzLCBjYWxsYmFjayk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICB9KTtcbiAgICB9XG59XG5cbmZ1bmN0aW9uIGRyaXZlVWkoKXtcbiAgICB2YXIgdGFza3MgPSBbXSxcbiAgICAgICAgZHJpdmVyRnVuY3Rpb25zID0ge307XG5cbiAgICBmdW5jdGlvbiBhZGRUYXNrKHRhc2spe1xuICAgICAgICB0YXNrcy5wdXNoKHRhc2spO1xuXG4gICAgICAgIHJldHVybiBkcml2ZXJGdW5jdGlvbnM7XG4gICAgfVxuXG4gICAgZHJpdmVyRnVuY3Rpb25zID0ge1xuICAgICAgICBuYXZpZ2F0ZTogZnVuY3Rpb24obG9jYXRpb24pe1xuICAgICAgICAgICAgcmV0dXJuIGFkZFRhc2soX25hdmlnYXRlLmJpbmQoZHJpdmVyRnVuY3Rpb25zLCBsb2NhdGlvbikpO1xuICAgICAgICB9LFxuICAgICAgICBmaW5kVWk6IGZ1bmN0aW9uKHZhbHVlLCB0eXBlKXtcbiAgICAgICAgICAgIHJldHVybiBhZGRUYXNrKF9maW5kVWkuYmluZChkcml2ZXJGdW5jdGlvbnMsIHZhbHVlLCB0eXBlKSk7XG4gICAgICAgIH0sXG4gICAgICAgIGdldExvY2F0aW9uOiBmdW5jdGlvbigpIHtcbiAgICAgICAgICAgIHJldHVybiBhZGRUYXNrKF9nZXRMb2NhdGlvbi5iaW5kKGRyaXZlckZ1bmN0aW9ucykpO1xuICAgICAgICB9LFxuICAgICAgICBmb2N1czogZnVuY3Rpb24odmFsdWUsIHR5cGUpIHtcbiAgICAgICAgICAgIHJldHVybiBhZGRUYXNrKGV4ZWN1dGUuYmluZChkcml2ZXJGdW5jdGlvbnMsIF9mb2N1cywgdmFsdWUsIHR5cGUpKTtcbiAgICAgICAgfSxcbiAgICAgICAgYmx1cjogZnVuY3Rpb24oKSB7XG4gICAgICAgICAgICByZXR1cm4gYWRkVGFzayhfYmx1ci5iaW5kKGRyaXZlckZ1bmN0aW9ucykpO1xuICAgICAgICB9LFxuICAgICAgICBjbGljazogZnVuY3Rpb24odmFsdWUsIHR5cGUpe1xuICAgICAgICAgICAgcmV0dXJuIGFkZFRhc2soZXhlY3V0ZUNsaWNrLmJpbmQoZHJpdmVyRnVuY3Rpb25zLCB2YWx1ZSwgdHlwZSkpO1xuICAgICAgICB9LFxuICAgICAgICBwcmVzc0tleTogZnVuY3Rpb24odmFsdWUpIHtcbiAgICAgICAgICAgIHJldHVybiBhZGRUYXNrKF9wcmVzc0tleS5iaW5kKGRyaXZlckZ1bmN0aW9ucywgdmFsdWUpKTtcbiAgICAgICAgfSxcbiAgICAgICAgcHJlc3NLZXlzOiBmdW5jdGlvbih2YWx1ZSkge1xuICAgICAgICAgICAgcmV0dXJuIGFkZFRhc2soX3ByZXNzS2V5cy5iaW5kKGRyaXZlckZ1bmN0aW9ucywgdmFsdWUpKTtcbiAgICAgICAgfSxcbiAgICAgICAgY2hhbmdlVmFsdWU6IGZ1bmN0aW9uKHNlbGVjdG9yLCB2YWx1ZSwgdHlwZSkge1xuICAgICAgICAgICAgcmV0dXJuIGFkZFRhc2soX2NoYW5nZVZhbHVlLmJpbmQoZHJpdmVyRnVuY3Rpb25zLCBzZWxlY3RvciwgdmFsdWUsIHR5cGUpKTtcbiAgICAgICAgfSxcbiAgICAgICAgc2V0VmFsdWU6IGZ1bmN0aW9uKHZhbHVlKSB7XG4gICAgICAgICAgICByZXR1cm4gYWRkVGFzayhfc2V0VmFsdWUuYmluZChkcml2ZXJGdW5jdGlvbnMsIHZhbHVlKSk7XG4gICAgICAgIH0sXG4gICAgICAgIHdhaXQ6IGZ1bmN0aW9uKHRpbWUpIHtcbiAgICAgICAgICAgIGlmKCFhcmd1bWVudHMubGVuZ3RoKSB7XG4gICAgICAgICAgICAgICAgdGltZSA9IHJ1bkRlbGF5O1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICByZXR1cm4gYWRkVGFzayhfd2FpdC5iaW5kKGRyaXZlckZ1bmN0aW9ucywgdGltZSkpO1xuICAgICAgICB9LFxuICAgICAgICBkbzogZnVuY3Rpb24oZHJpdmVyKXtcbiAgICAgICAgICAgIHJldHVybiBhZGRUYXNrKGRyaXZlci5nbyk7XG4gICAgICAgIH0sXG4gICAgICAgIGdvOiBmdW5jdGlvbihjYWxsYmFjaykge1xuICAgICAgICAgICAgaWYoIWluaXRpYWxpc2VkKSB7XG4gICAgICAgICAgICAgICAgdGhyb3cobmV3IEVycm9yKCdpbml0IG11c3QgYmVjYWxsZWQgYmVmb3JlIGNhbGxpbmcgZ28nKSk7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGlmKHRhc2tzLmxlbmd0aCkge1xuICAgICAgICAgICAgICAgIHRhc2tzLnVuc2hpZnQoX3dhaXQuYmluZChkcml2ZXJGdW5jdGlvbnMsIHJ1bkRlbGF5KSk7XG4gICAgICAgICAgICAgICAgcnVuVGFza3ModGFza3MsIGNhbGxiYWNrKTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgY2FsbGJhY2sobmV3IEVycm9yKCdObyB0YXNrcyBkZWZpbmVkJykpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfTtcblxuICAgIHJldHVybiBkcml2ZXJGdW5jdGlvbnM7XG59XG5cbmRyaXZlVWkuaW5pdCA9IGZ1bmN0aW9uKHNldHRpbmdzKSB7XG4gICAgZG9jdW1lbnRTY29wZSA9IHNldHRpbmdzLmRvY3VtZW50IHx8IGRvY3VtZW50O1xuICAgIHdpbmRvd1Njb3BlID0gc2V0dGluZ3Mud2luZG93IHx8IHdpbmRvdztcbiAgICBydW5EZWxheSA9IHNldHRpbmdzLnJ1bkRlbGF5IHx8IDA7XG5cbiAgICBpbml0aWFsaXNlZCA9IHRydWU7XG59O1xuXG5tb2R1bGUuZXhwb3J0cyA9IGRyaXZlVWk7XG4iLCJmdW5jdGlvbiBmaW5kQ2hpbGRzRXhwb3NlZEJveChjaGlsZCl7XG4gICAgdmFyIG9yaWdpbmFsQm91bmRzID0gY2hpbGQuZ2V0Qm91bmRpbmdDbGllbnRSZWN0KCksXG4gICAgICAgIHBhcmVudCA9IGNoaWxkLnBhcmVudE5vZGUsXG4gICAgICAgIHBhcmVudE92ZXJmbG93LFxuICAgICAgICBwYXJlbnRCb3VuZHMsXG4gICAgICAgIGJvdW5kcztcblxuICAgIC8vIENvbnZlcnQgYm91bmRzIG9iamVjdCB0byBwb2pvLlxuICAgIGJvdW5kcyA9IHtcbiAgICAgICAgb3JpZ2luYWw6IG9yaWdpbmFsQm91bmRzLFxuICAgICAgICBoZWlnaHQ6IG9yaWdpbmFsQm91bmRzLmhlaWdodCxcbiAgICAgICAgd2lkdGg6IG9yaWdpbmFsQm91bmRzLndpZHRoLFxuICAgICAgICBsZWZ0OiBvcmlnaW5hbEJvdW5kcy5sZWZ0LFxuICAgICAgICB0b3A6IG9yaWdpbmFsQm91bmRzLnRvcCxcbiAgICAgICAgcmlnaHQ6IG9yaWdpbmFsQm91bmRzLnJpZ2h0LFxuICAgICAgICBib3R0b206IG9yaWdpbmFsQm91bmRzLmJvdHRvbVxuICAgIH07XG5cbiAgICB3aGlsZShwYXJlbnQpe1xuICAgICAgICBpZihwYXJlbnQgPT09IGRvY3VtZW50KXtcbiAgICAgICAgICAgIHBhcmVudEJvdW5kcyA9IHtcbiAgICAgICAgICAgICAgICB0b3A6IDAsXG4gICAgICAgICAgICAgICAgbGVmdDogMCxcbiAgICAgICAgICAgICAgICBib3R0b206IHdpbmRvdy5pbm5lckhlaWdodCxcbiAgICAgICAgICAgICAgICByaWdodDogd2luZG93LmlubmVyV2lkdGgsXG4gICAgICAgICAgICAgICAgaGVpZ2h0OiB3aW5kb3cuaW5uZXJIZWlnaHQsXG4gICAgICAgICAgICAgICAgd2lkdGg6IHdpbmRvdy5pbm5lcldpZHRoXG4gICAgICAgICAgICB9O1xuICAgICAgICB9ZWxzZXtcbiAgICAgICAgICAgIGlmKHdpbmRvdy5nZXRDb21wdXRlZFN0eWxlKHBhcmVudCkub3ZlcmZsb3cgPT09ICd2aXNpYmxlJyl7XG4gICAgICAgICAgICAgICAgcGFyZW50ID0gcGFyZW50Lm9mZnNldFBhcmVudDtcbiAgICAgICAgICAgICAgICBjb250aW51ZTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHBhcmVudEJvdW5kcyA9IHBhcmVudC5nZXRCb3VuZGluZ0NsaWVudFJlY3QoKTtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmKHBhcmVudEJvdW5kcy50b3AgPiBib3VuZHMudG9wKXtcbiAgICAgICAgICAgIGJvdW5kcy5oZWlnaHQgPSBib3VuZHMuaGVpZ2h0IC0gKHBhcmVudEJvdW5kcy50b3AgLSBib3VuZHMudG9wKTtcbiAgICAgICAgICAgIGJvdW5kcy50b3AgPSBwYXJlbnRCb3VuZHMudG9wO1xuICAgICAgICB9XG4gICAgICAgIGlmKHBhcmVudEJvdW5kcy5sZWZ0ID4gYm91bmRzLmxlZnQpe1xuICAgICAgICAgICAgYm91bmRzLndpZHRoID0gYm91bmRzLndpZHRoIC0gKHBhcmVudEJvdW5kcy5sZWZ0IC0gYm91bmRzLmxlZnQpO1xuICAgICAgICAgICAgYm91bmRzLmxlZnQgPSBwYXJlbnRCb3VuZHMubGVmdDtcbiAgICAgICAgfVxuICAgICAgICBpZihwYXJlbnRCb3VuZHMucmlnaHQgPCBib3VuZHMucmlnaHQpe1xuICAgICAgICAgICAgYm91bmRzLndpZHRoID0gYm91bmRzLndpZHRoIC0gKGJvdW5kcy5yaWdodCAtIHBhcmVudEJvdW5kcy5yaWdodCk7XG4gICAgICAgICAgICBib3VuZHMucmlnaHQgPSBwYXJlbnRCb3VuZHMucmlnaHQ7XG4gICAgICAgIH1cbiAgICAgICAgaWYocGFyZW50Qm91bmRzLmJvdHRvbSA8IGJvdW5kcy5ib3R0b20pe1xuICAgICAgICAgICAgYm91bmRzLmhlaWdodCA9IGJvdW5kcy5oZWlnaHQgLSAoYm91bmRzLmJvdHRvbSAtIHBhcmVudEJvdW5kcy5ib3R0b20pO1xuICAgICAgICAgICAgYm91bmRzLmJvdHRvbSA9IHBhcmVudEJvdW5kcy5ib3R0b207XG4gICAgICAgIH1cblxuICAgICAgICBpZihib3VuZHMud2lkdGggPD0gMCB8fCBib3VuZHMuaGVpZ2h0IDw9IDApe1xuICAgICAgICAgICAgYm91bmRzLmhpZGRlbiA9IHRydWU7XG4gICAgICAgICAgICBib3VuZHMud2lkdGggPSBNYXRoLm1heChib3VuZHMud2lkdGgsIDApO1xuICAgICAgICAgICAgYm91bmRzLmhlaWdodCA9IE1hdGgubWF4KGJvdW5kcy5oZWlnaHQsIDApO1xuICAgICAgICAgICAgcmV0dXJuIGJvdW5kcztcbiAgICAgICAgfVxuXG4gICAgICAgIHBhcmVudCA9IHBhcmVudC5wYXJlbnROb2RlO1xuICAgIH1cblxuICAgIHJldHVybiBib3VuZHM7XG59XG5cbm1vZHVsZS5leHBvcnRzID0gZmluZENoaWxkc0V4cG9zZWRCb3g7IiwiLy9Db3B5cmlnaHQgKEMpIDIwMTIgS29yeSBOdW5uXHJcblxyXG4vL1Blcm1pc3Npb24gaXMgaGVyZWJ5IGdyYW50ZWQsIGZyZWUgb2YgY2hhcmdlLCB0byBhbnkgcGVyc29uIG9idGFpbmluZyBhIGNvcHkgb2YgdGhpcyBzb2Z0d2FyZSBhbmQgYXNzb2NpYXRlZCBkb2N1bWVudGF0aW9uIGZpbGVzICh0aGUgXCJTb2Z0d2FyZVwiKSwgdG8gZGVhbCBpbiB0aGUgU29mdHdhcmUgd2l0aG91dCByZXN0cmljdGlvbiwgaW5jbHVkaW5nIHdpdGhvdXQgbGltaXRhdGlvbiB0aGUgcmlnaHRzIHRvIHVzZSwgY29weSwgbW9kaWZ5LCBtZXJnZSwgcHVibGlzaCwgZGlzdHJpYnV0ZSwgc3VibGljZW5zZSwgYW5kL29yIHNlbGwgY29waWVzIG9mIHRoZSBTb2Z0d2FyZSwgYW5kIHRvIHBlcm1pdCBwZXJzb25zIHRvIHdob20gdGhlIFNvZnR3YXJlIGlzIGZ1cm5pc2hlZCB0byBkbyBzbywgc3ViamVjdCB0byB0aGUgZm9sbG93aW5nIGNvbmRpdGlvbnM6XHJcblxyXG4vL1RoZSBhYm92ZSBjb3B5cmlnaHQgbm90aWNlIGFuZCB0aGlzIHBlcm1pc3Npb24gbm90aWNlIHNoYWxsIGJlIGluY2x1ZGVkIGluIGFsbCBjb3BpZXMgb3Igc3Vic3RhbnRpYWwgcG9ydGlvbnMgb2YgdGhlIFNvZnR3YXJlLlxyXG5cclxuLy9USEUgU09GVFdBUkUgSVMgUFJPVklERUQgXCJBUyBJU1wiLCBXSVRIT1VUIFdBUlJBTlRZIE9GIEFOWSBLSU5ELCBFWFBSRVNTIE9SIElNUExJRUQsIElOQ0xVRElORyBCVVQgTk9UIExJTUlURUQgVE8gVEhFIFdBUlJBTlRJRVMgT0YgTUVSQ0hBTlRBQklMSVRZLCBGSVRORVNTIEZPUiBBIFBBUlRJQ1VMQVIgUFVSUE9TRSBBTkQgTk9OSU5GUklOR0VNRU5ULiBJTiBOTyBFVkVOVCBTSEFMTCBUSEUgQVVUSE9SUyBPUiBDT1BZUklHSFQgSE9MREVSUyBCRSBMSUFCTEUgRk9SIEFOWSBDTEFJTSwgREFNQUdFUyBPUiBPVEhFUiBMSUFCSUxJVFksIFdIRVRIRVIgSU4gQU4gQUNUSU9OIE9GIENPTlRSQUNULCBUT1JUIE9SIE9USEVSV0lTRSwgQVJJU0lORyBGUk9NLCBPVVQgT0YgT1IgSU4gQ09OTkVDVElPTiBXSVRIIFRIRSBTT0ZUV0FSRSBPUiBUSEUgVVNFIE9SIE9USEVSIERFQUxJTkdTIElOIFRIRSBTT0ZUV0FSRS5cclxuXHJcbi8qXHJcblxyXG4gICAgVGhpcyBjb2RlIGlzIG5vdCBmb3JtYXR0ZWQgZm9yIHJlYWRhYmlsaXR5LCBidXQgcmF0aGVyIHJ1bi1zcGVlZCBhbmQgdG8gYXNzaXN0IGNvbXBpbGVycy5cclxuXHJcbiAgICBIb3dldmVyLCB0aGUgY29kZSdzIGludGVudGlvbiBzaG91bGQgYmUgdHJhbnNwYXJlbnQuXHJcblxyXG4gICAgKioqIElFIFNVUFBPUlQgKioqXHJcblxyXG4gICAgSWYgeW91IHJlcXVpcmUgdGhpcyBsaWJyYXJ5IHRvIHdvcmsgaW4gSUU3LCBhZGQgdGhlIGZvbGxvd2luZyBhZnRlciBkZWNsYXJpbmcgY3JlbC5cclxuXHJcbiAgICB2YXIgdGVzdERpdiA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2RpdicpLFxyXG4gICAgICAgIHRlc3RMYWJlbCA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2xhYmVsJyk7XHJcblxyXG4gICAgdGVzdERpdi5zZXRBdHRyaWJ1dGUoJ2NsYXNzJywgJ2EnKTtcclxuICAgIHRlc3REaXZbJ2NsYXNzTmFtZSddICE9PSAnYScgPyBjcmVsLmF0dHJNYXBbJ2NsYXNzJ10gPSAnY2xhc3NOYW1lJzp1bmRlZmluZWQ7XHJcbiAgICB0ZXN0RGl2LnNldEF0dHJpYnV0ZSgnbmFtZScsJ2EnKTtcclxuICAgIHRlc3REaXZbJ25hbWUnXSAhPT0gJ2EnID8gY3JlbC5hdHRyTWFwWyduYW1lJ10gPSBmdW5jdGlvbihlbGVtZW50LCB2YWx1ZSl7XHJcbiAgICAgICAgZWxlbWVudC5pZCA9IHZhbHVlO1xyXG4gICAgfTp1bmRlZmluZWQ7XHJcblxyXG5cclxuICAgIHRlc3RMYWJlbC5zZXRBdHRyaWJ1dGUoJ2ZvcicsICdhJyk7XHJcbiAgICB0ZXN0TGFiZWxbJ2h0bWxGb3InXSAhPT0gJ2EnID8gY3JlbC5hdHRyTWFwWydmb3InXSA9ICdodG1sRm9yJzp1bmRlZmluZWQ7XHJcblxyXG5cclxuXHJcbiovXHJcblxyXG4oZnVuY3Rpb24gKHJvb3QsIGZhY3RvcnkpIHtcclxuICAgIGlmICh0eXBlb2YgZXhwb3J0cyA9PT0gJ29iamVjdCcpIHtcclxuICAgICAgICBtb2R1bGUuZXhwb3J0cyA9IGZhY3RvcnkoKTtcclxuICAgIH0gZWxzZSBpZiAodHlwZW9mIGRlZmluZSA9PT0gJ2Z1bmN0aW9uJyAmJiBkZWZpbmUuYW1kKSB7XHJcbiAgICAgICAgZGVmaW5lKGZhY3RvcnkpO1xyXG4gICAgfSBlbHNlIHtcclxuICAgICAgICByb290LmNyZWwgPSBmYWN0b3J5KCk7XHJcbiAgICB9XHJcbn0odGhpcywgZnVuY3Rpb24gKCkge1xyXG4gICAgdmFyIGZuID0gJ2Z1bmN0aW9uJyxcclxuICAgICAgICBvYmogPSAnb2JqZWN0JyxcclxuICAgICAgICBub2RlVHlwZSA9ICdub2RlVHlwZScsXHJcbiAgICAgICAgdGV4dENvbnRlbnQgPSAndGV4dENvbnRlbnQnLFxyXG4gICAgICAgIHNldEF0dHJpYnV0ZSA9ICdzZXRBdHRyaWJ1dGUnLFxyXG4gICAgICAgIGF0dHJNYXBTdHJpbmcgPSAnYXR0ck1hcCcsXHJcbiAgICAgICAgaXNOb2RlU3RyaW5nID0gJ2lzTm9kZScsXHJcbiAgICAgICAgaXNFbGVtZW50U3RyaW5nID0gJ2lzRWxlbWVudCcsXHJcbiAgICAgICAgZCA9IHR5cGVvZiBkb2N1bWVudCA9PT0gb2JqID8gZG9jdW1lbnQgOiB7fSxcclxuICAgICAgICBpc1R5cGUgPSBmdW5jdGlvbihhLCB0eXBlKXtcclxuICAgICAgICAgICAgcmV0dXJuIHR5cGVvZiBhID09PSB0eXBlO1xyXG4gICAgICAgIH0sXHJcbiAgICAgICAgaXNOb2RlID0gdHlwZW9mIE5vZGUgPT09IGZuID8gZnVuY3Rpb24gKG9iamVjdCkge1xyXG4gICAgICAgICAgICByZXR1cm4gb2JqZWN0IGluc3RhbmNlb2YgTm9kZTtcclxuICAgICAgICB9IDpcclxuICAgICAgICAvLyBpbiBJRSA8PSA4IE5vZGUgaXMgYW4gb2JqZWN0LCBvYnZpb3VzbHkuLlxyXG4gICAgICAgIGZ1bmN0aW9uKG9iamVjdCl7XHJcbiAgICAgICAgICAgIHJldHVybiBvYmplY3QgJiZcclxuICAgICAgICAgICAgICAgIGlzVHlwZShvYmplY3QsIG9iaikgJiZcclxuICAgICAgICAgICAgICAgIChub2RlVHlwZSBpbiBvYmplY3QpICYmXHJcbiAgICAgICAgICAgICAgICBpc1R5cGUob2JqZWN0Lm93bmVyRG9jdW1lbnQsb2JqKTtcclxuICAgICAgICB9LFxyXG4gICAgICAgIGlzRWxlbWVudCA9IGZ1bmN0aW9uIChvYmplY3QpIHtcclxuICAgICAgICAgICAgcmV0dXJuIGNyZWxbaXNOb2RlU3RyaW5nXShvYmplY3QpICYmIG9iamVjdFtub2RlVHlwZV0gPT09IDE7XHJcbiAgICAgICAgfSxcclxuICAgICAgICBpc0FycmF5ID0gZnVuY3Rpb24oYSl7XHJcbiAgICAgICAgICAgIHJldHVybiBhIGluc3RhbmNlb2YgQXJyYXk7XHJcbiAgICAgICAgfSxcclxuICAgICAgICBhcHBlbmRDaGlsZCA9IGZ1bmN0aW9uKGVsZW1lbnQsIGNoaWxkKSB7XHJcbiAgICAgICAgICBpZighY3JlbFtpc05vZGVTdHJpbmddKGNoaWxkKSl7XHJcbiAgICAgICAgICAgICAgY2hpbGQgPSBkLmNyZWF0ZVRleHROb2RlKGNoaWxkKTtcclxuICAgICAgICAgIH1cclxuICAgICAgICAgIGVsZW1lbnQuYXBwZW5kQ2hpbGQoY2hpbGQpO1xyXG4gICAgICAgIH07XHJcblxyXG5cclxuICAgIGZ1bmN0aW9uIGNyZWwoKXtcclxuICAgICAgICB2YXIgYXJncyA9IGFyZ3VtZW50cywgLy9Ob3RlOiBhc3NpZ25lZCB0byBhIHZhcmlhYmxlIHRvIGFzc2lzdCBjb21waWxlcnMuIFNhdmVzIGFib3V0IDQwIGJ5dGVzIGluIGNsb3N1cmUgY29tcGlsZXIuIEhhcyBuZWdsaWdhYmxlIGVmZmVjdCBvbiBwZXJmb3JtYW5jZS5cclxuICAgICAgICAgICAgZWxlbWVudCA9IGFyZ3NbMF0sXHJcbiAgICAgICAgICAgIGNoaWxkLFxyXG4gICAgICAgICAgICBzZXR0aW5ncyA9IGFyZ3NbMV0sXHJcbiAgICAgICAgICAgIGNoaWxkSW5kZXggPSAyLFxyXG4gICAgICAgICAgICBhcmd1bWVudHNMZW5ndGggPSBhcmdzLmxlbmd0aCxcclxuICAgICAgICAgICAgYXR0cmlidXRlTWFwID0gY3JlbFthdHRyTWFwU3RyaW5nXTtcclxuXHJcbiAgICAgICAgZWxlbWVudCA9IGNyZWxbaXNFbGVtZW50U3RyaW5nXShlbGVtZW50KSA/IGVsZW1lbnQgOiBkLmNyZWF0ZUVsZW1lbnQoZWxlbWVudCk7XHJcbiAgICAgICAgLy8gc2hvcnRjdXRcclxuICAgICAgICBpZihhcmd1bWVudHNMZW5ndGggPT09IDEpe1xyXG4gICAgICAgICAgICByZXR1cm4gZWxlbWVudDtcclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIGlmKCFpc1R5cGUoc2V0dGluZ3Msb2JqKSB8fCBjcmVsW2lzTm9kZVN0cmluZ10oc2V0dGluZ3MpIHx8IGlzQXJyYXkoc2V0dGluZ3MpKSB7XHJcbiAgICAgICAgICAgIC0tY2hpbGRJbmRleDtcclxuICAgICAgICAgICAgc2V0dGluZ3MgPSBudWxsO1xyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgLy8gc2hvcnRjdXQgaWYgdGhlcmUgaXMgb25seSBvbmUgY2hpbGQgdGhhdCBpcyBhIHN0cmluZ1xyXG4gICAgICAgIGlmKChhcmd1bWVudHNMZW5ndGggLSBjaGlsZEluZGV4KSA9PT0gMSAmJiBpc1R5cGUoYXJnc1tjaGlsZEluZGV4XSwgJ3N0cmluZycpICYmIGVsZW1lbnRbdGV4dENvbnRlbnRdICE9PSB1bmRlZmluZWQpe1xyXG4gICAgICAgICAgICBlbGVtZW50W3RleHRDb250ZW50XSA9IGFyZ3NbY2hpbGRJbmRleF07XHJcbiAgICAgICAgfWVsc2V7XHJcbiAgICAgICAgICAgIGZvcig7IGNoaWxkSW5kZXggPCBhcmd1bWVudHNMZW5ndGg7ICsrY2hpbGRJbmRleCl7XHJcbiAgICAgICAgICAgICAgICBjaGlsZCA9IGFyZ3NbY2hpbGRJbmRleF07XHJcblxyXG4gICAgICAgICAgICAgICAgaWYoY2hpbGQgPT0gbnVsbCl7XHJcbiAgICAgICAgICAgICAgICAgICAgY29udGludWU7XHJcbiAgICAgICAgICAgICAgICB9XHJcblxyXG4gICAgICAgICAgICAgICAgaWYgKGlzQXJyYXkoY2hpbGQpKSB7XHJcbiAgICAgICAgICAgICAgICAgIGZvciAodmFyIGk9MDsgaSA8IGNoaWxkLmxlbmd0aDsgKytpKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgYXBwZW5kQ2hpbGQoZWxlbWVudCwgY2hpbGRbaV0pO1xyXG4gICAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICB9IGVsc2Uge1xyXG4gICAgICAgICAgICAgICAgICBhcHBlbmRDaGlsZChlbGVtZW50LCBjaGlsZCk7XHJcbiAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIGZvcih2YXIga2V5IGluIHNldHRpbmdzKXtcclxuICAgICAgICAgICAgaWYoIWF0dHJpYnV0ZU1hcFtrZXldKXtcclxuICAgICAgICAgICAgICAgIGVsZW1lbnRbc2V0QXR0cmlidXRlXShrZXksIHNldHRpbmdzW2tleV0pO1xyXG4gICAgICAgICAgICB9ZWxzZXtcclxuICAgICAgICAgICAgICAgIHZhciBhdHRyID0gYXR0cmlidXRlTWFwW2tleV07XHJcbiAgICAgICAgICAgICAgICBpZih0eXBlb2YgYXR0ciA9PT0gZm4pe1xyXG4gICAgICAgICAgICAgICAgICAgIGF0dHIoZWxlbWVudCwgc2V0dGluZ3Nba2V5XSk7XHJcbiAgICAgICAgICAgICAgICB9ZWxzZXtcclxuICAgICAgICAgICAgICAgICAgICBlbGVtZW50W3NldEF0dHJpYnV0ZV0oYXR0ciwgc2V0dGluZ3Nba2V5XSk7XHJcbiAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIHJldHVybiBlbGVtZW50O1xyXG4gICAgfVxyXG5cclxuICAgIC8vIFVzZWQgZm9yIG1hcHBpbmcgb25lIGtpbmQgb2YgYXR0cmlidXRlIHRvIHRoZSBzdXBwb3J0ZWQgdmVyc2lvbiBvZiB0aGF0IGluIGJhZCBicm93c2Vycy5cclxuICAgIGNyZWxbYXR0ck1hcFN0cmluZ10gPSB7fTtcclxuXHJcbiAgICBjcmVsW2lzRWxlbWVudFN0cmluZ10gPSBpc0VsZW1lbnQ7XHJcblxyXG4gICAgY3JlbFtpc05vZGVTdHJpbmddID0gaXNOb2RlO1xyXG5cclxuICAgIGlmKHR5cGVvZiBQcm94eSAhPT0gJ3VuZGVmaW5lZCcpe1xyXG4gICAgICAgIHJldHVybiBuZXcgUHJveHkoY3JlbCwge1xyXG4gICAgICAgICAgICBnZXQ6IGZ1bmN0aW9uKHRhcmdldCwga2V5KXtcclxuICAgICAgICAgICAgICAgICEoa2V5IGluIGNyZWwpICYmIChjcmVsW2tleV0gPSBjcmVsLmJpbmQobnVsbCwga2V5KSk7XHJcbiAgICAgICAgICAgICAgICByZXR1cm4gY3JlbFtrZXldO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgfSk7XHJcbiAgICB9XHJcblxyXG4gICAgcmV0dXJuIGNyZWw7XHJcbn0pKTtcclxuIiwidmFyIGRvYyA9IHtcclxuICAgIGRvY3VtZW50OiB0eXBlb2YgZG9jdW1lbnQgIT09ICd1bmRlZmluZWQnID8gZG9jdW1lbnQgOiBudWxsLFxyXG4gICAgc2V0RG9jdW1lbnQ6IGZ1bmN0aW9uKGQpe1xyXG4gICAgICAgIHRoaXMuZG9jdW1lbnQgPSBkO1xyXG4gICAgfVxyXG59O1xyXG5cclxudmFyIGFycmF5UHJvdG8gPSBbXSxcclxuICAgIGlzTGlzdCA9IHJlcXVpcmUoJy4vaXNMaXN0JyksXHJcbiAgICBnZXRUYXJnZXRzID0gcmVxdWlyZSgnLi9nZXRUYXJnZXRzJykoZG9jLmRvY3VtZW50KSxcclxuICAgIGdldFRhcmdldCA9IHJlcXVpcmUoJy4vZ2V0VGFyZ2V0JykoZG9jLmRvY3VtZW50KSxcclxuICAgIHNwYWNlID0gJyAnO1xyXG5cclxuXHJcbi8vL1tSRUFETUUubWRdXHJcblxyXG5mdW5jdGlvbiBpc0luKGFycmF5LCBpdGVtKXtcclxuICAgIGZvcih2YXIgaSA9IDA7IGkgPCBhcnJheS5sZW5ndGg7IGkrKykge1xyXG4gICAgICAgIGlmKGl0ZW0gPT09IGFycmF5W2ldKXtcclxuICAgICAgICAgICAgcmV0dXJuIHRydWU7XHJcbiAgICAgICAgfVxyXG4gICAgfVxyXG59XHJcblxyXG4vKipcclxuXHJcbiAgICAjIyAuZmluZFxyXG5cclxuICAgIGZpbmRzIGVsZW1lbnRzIHRoYXQgbWF0Y2ggdGhlIHF1ZXJ5IHdpdGhpbiB0aGUgc2NvcGUgb2YgdGFyZ2V0XHJcblxyXG4gICAgICAgIC8vZmx1ZW50XHJcbiAgICAgICAgZG9jKHRhcmdldCkuZmluZChxdWVyeSk7XHJcblxyXG4gICAgICAgIC8vbGVnYWN5XHJcbiAgICAgICAgZG9jLmZpbmQodGFyZ2V0LCBxdWVyeSk7XHJcbiovXHJcblxyXG5mdW5jdGlvbiBmaW5kKHRhcmdldCwgcXVlcnkpe1xyXG4gICAgdGFyZ2V0ID0gZ2V0VGFyZ2V0cyh0YXJnZXQpO1xyXG4gICAgaWYocXVlcnkgPT0gbnVsbCl7XHJcbiAgICAgICAgcmV0dXJuIHRhcmdldDtcclxuICAgIH1cclxuXHJcbiAgICBpZihpc0xpc3QodGFyZ2V0KSl7XHJcbiAgICAgICAgdmFyIHJlc3VsdHMgPSBbXTtcclxuICAgICAgICBmb3IgKHZhciBpID0gMDsgaSA8IHRhcmdldC5sZW5ndGg7IGkrKykge1xyXG4gICAgICAgICAgICB2YXIgc3ViUmVzdWx0cyA9IGRvYy5maW5kKHRhcmdldFtpXSwgcXVlcnkpO1xyXG4gICAgICAgICAgICBmb3IodmFyIGogPSAwOyBqIDwgc3ViUmVzdWx0cy5sZW5ndGg7IGorKykge1xyXG4gICAgICAgICAgICAgICAgaWYoIWlzSW4ocmVzdWx0cywgc3ViUmVzdWx0c1tqXSkpe1xyXG4gICAgICAgICAgICAgICAgICAgIHJlc3VsdHMucHVzaChzdWJSZXN1bHRzW2pdKTtcclxuICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgfVxyXG4gICAgICAgIH1cclxuICAgICAgICByZXR1cm4gcmVzdWx0cztcclxuICAgIH1cclxuXHJcbiAgICByZXR1cm4gdGFyZ2V0ID8gdGFyZ2V0LnF1ZXJ5U2VsZWN0b3JBbGwocXVlcnkpIDogW107XHJcbn1cclxuXHJcbi8qKlxyXG5cclxuICAgICMjIC5maW5kT25lXHJcblxyXG4gICAgZmluZHMgdGhlIGZpcnN0IGVsZW1lbnQgdGhhdCBtYXRjaGVzIHRoZSBxdWVyeSB3aXRoaW4gdGhlIHNjb3BlIG9mIHRhcmdldFxyXG5cclxuICAgICAgICAvL2ZsdWVudFxyXG4gICAgICAgIGRvYyh0YXJnZXQpLmZpbmRPbmUocXVlcnkpO1xyXG5cclxuICAgICAgICAvL2xlZ2FjeVxyXG4gICAgICAgIGRvYy5maW5kT25lKHRhcmdldCwgcXVlcnkpO1xyXG4qL1xyXG5cclxuZnVuY3Rpb24gZmluZE9uZSh0YXJnZXQsIHF1ZXJ5KXtcclxuICAgIHRhcmdldCA9IGdldFRhcmdldCh0YXJnZXQpO1xyXG4gICAgaWYocXVlcnkgPT0gbnVsbCl7XHJcbiAgICAgICAgcmV0dXJuIHRhcmdldDtcclxuICAgIH1cclxuXHJcbiAgICBpZihpc0xpc3QodGFyZ2V0KSl7XHJcbiAgICAgICAgdmFyIHJlc3VsdDtcclxuICAgICAgICBmb3IgKHZhciBpID0gMDsgaSA8IHRhcmdldC5sZW5ndGg7IGkrKykge1xyXG4gICAgICAgICAgICByZXN1bHQgPSBmaW5kT25lKHRhcmdldFtpXSwgcXVlcnkpO1xyXG4gICAgICAgICAgICBpZihyZXN1bHQpe1xyXG4gICAgICAgICAgICAgICAgYnJlYWs7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICB9XHJcbiAgICAgICAgcmV0dXJuIHJlc3VsdDtcclxuICAgIH1cclxuXHJcbiAgICByZXR1cm4gdGFyZ2V0ID8gdGFyZ2V0LnF1ZXJ5U2VsZWN0b3IocXVlcnkpIDogbnVsbDtcclxufVxyXG5cclxuLyoqXHJcblxyXG4gICAgIyMgLmNsb3Nlc3RcclxuXHJcbiAgICByZWN1cnNlcyB1cCB0aGUgRE9NIGZyb20gdGhlIHRhcmdldCBub2RlLCBjaGVja2luZyBpZiB0aGUgY3VycmVudCBlbGVtZW50IG1hdGNoZXMgdGhlIHF1ZXJ5XHJcblxyXG4gICAgICAgIC8vZmx1ZW50XHJcbiAgICAgICAgZG9jKHRhcmdldCkuY2xvc2VzdChxdWVyeSk7XHJcblxyXG4gICAgICAgIC8vbGVnYWN5XHJcbiAgICAgICAgZG9jLmNsb3Nlc3QodGFyZ2V0LCBxdWVyeSk7XHJcbiovXHJcblxyXG5mdW5jdGlvbiBjbG9zZXN0KHRhcmdldCwgcXVlcnkpe1xyXG4gICAgdGFyZ2V0ID0gZ2V0VGFyZ2V0KHRhcmdldCk7XHJcblxyXG4gICAgaWYoaXNMaXN0KHRhcmdldCkpe1xyXG4gICAgICAgIHRhcmdldCA9IHRhcmdldFswXTtcclxuICAgIH1cclxuXHJcbiAgICB3aGlsZShcclxuICAgICAgICB0YXJnZXQgJiZcclxuICAgICAgICB0YXJnZXQub3duZXJEb2N1bWVudCAmJlxyXG4gICAgICAgICFpcyh0YXJnZXQsIHF1ZXJ5KVxyXG4gICAgKXtcclxuICAgICAgICB0YXJnZXQgPSB0YXJnZXQucGFyZW50Tm9kZTtcclxuICAgIH1cclxuXHJcbiAgICByZXR1cm4gdGFyZ2V0ID09PSBkb2MuZG9jdW1lbnQgJiYgdGFyZ2V0ICE9PSBxdWVyeSA/IG51bGwgOiB0YXJnZXQ7XHJcbn1cclxuXHJcbi8qKlxyXG5cclxuICAgICMjIC5pc1xyXG5cclxuICAgIHJldHVybnMgdHJ1ZSBpZiB0aGUgdGFyZ2V0IGVsZW1lbnQgbWF0Y2hlcyB0aGUgcXVlcnlcclxuXHJcbiAgICAgICAgLy9mbHVlbnRcclxuICAgICAgICBkb2ModGFyZ2V0KS5pcyhxdWVyeSk7XHJcblxyXG4gICAgICAgIC8vbGVnYWN5XHJcbiAgICAgICAgZG9jLmlzKHRhcmdldCwgcXVlcnkpO1xyXG4qL1xyXG5cclxuZnVuY3Rpb24gaXModGFyZ2V0LCBxdWVyeSl7XHJcbiAgICB0YXJnZXQgPSBnZXRUYXJnZXQodGFyZ2V0KTtcclxuXHJcbiAgICBpZihpc0xpc3QodGFyZ2V0KSl7XHJcbiAgICAgICAgdGFyZ2V0ID0gdGFyZ2V0WzBdO1xyXG4gICAgfVxyXG5cclxuICAgIGlmKCF0YXJnZXQub3duZXJEb2N1bWVudCB8fCB0eXBlb2YgcXVlcnkgIT09ICdzdHJpbmcnKXtcclxuICAgICAgICByZXR1cm4gdGFyZ2V0ID09PSBxdWVyeTtcclxuICAgIH1cclxuXHJcbiAgICBpZih0YXJnZXQgPT09IHF1ZXJ5KXtcclxuICAgICAgICByZXR1cm4gdHJ1ZTtcclxuICAgIH1cclxuXHJcbiAgICB2YXIgcGFyZW50bGVzcyA9ICF0YXJnZXQucGFyZW50Tm9kZTtcclxuXHJcbiAgICBpZihwYXJlbnRsZXNzKXtcclxuICAgICAgICAvLyBHaXZlIHRoZSBlbGVtZW50IGEgcGFyZW50IHNvIHRoYXQgLnF1ZXJ5U2VsZWN0b3JBbGwgY2FuIGJlIHVzZWRcclxuICAgICAgICBkb2N1bWVudC5jcmVhdGVEb2N1bWVudEZyYWdtZW50KCkuYXBwZW5kQ2hpbGQodGFyZ2V0KTtcclxuICAgIH1cclxuXHJcbiAgICB2YXIgcmVzdWx0ID0gYXJyYXlQcm90by5pbmRleE9mLmNhbGwoZmluZCh0YXJnZXQucGFyZW50Tm9kZSwgcXVlcnkpLCB0YXJnZXQpID49IDA7XHJcblxyXG4gICAgaWYocGFyZW50bGVzcyl7XHJcbiAgICAgICAgdGFyZ2V0LnBhcmVudE5vZGUucmVtb3ZlQ2hpbGQodGFyZ2V0KTtcclxuICAgIH1cclxuXHJcbiAgICByZXR1cm4gcmVzdWx0O1xyXG59XHJcblxyXG4vKipcclxuXHJcbiAgICAjIyAuYWRkQ2xhc3NcclxuXHJcbiAgICBhZGRzIGNsYXNzZXMgdG8gdGhlIHRhcmdldCAoc3BhY2Ugc2VwYXJhdGVkIHN0cmluZyBvciBhcnJheSlcclxuXHJcbiAgICAgICAgLy9mbHVlbnRcclxuICAgICAgICBkb2ModGFyZ2V0KS5hZGRDbGFzcyhxdWVyeSk7XHJcblxyXG4gICAgICAgIC8vbGVnYWN5XHJcbiAgICAgICAgZG9jLmFkZENsYXNzKHRhcmdldCwgcXVlcnkpO1xyXG4qL1xyXG5cclxuZnVuY3Rpb24gYWRkQ2xhc3ModGFyZ2V0LCBjbGFzc2VzKXtcclxuICAgIHRhcmdldCA9IGdldFRhcmdldHModGFyZ2V0KTtcclxuXHJcbiAgICBpZihpc0xpc3QodGFyZ2V0KSl7XHJcbiAgICAgICAgZm9yICh2YXIgaSA9IDA7IGkgPCB0YXJnZXQubGVuZ3RoOyBpKyspIHtcclxuICAgICAgICAgICAgYWRkQ2xhc3ModGFyZ2V0W2ldLCBjbGFzc2VzKTtcclxuICAgICAgICB9XHJcbiAgICAgICAgcmV0dXJuIHRoaXM7XHJcbiAgICB9XHJcbiAgICBpZighY2xhc3Nlcyl7XHJcbiAgICAgICAgcmV0dXJuIHRoaXM7XHJcbiAgICB9XHJcblxyXG4gICAgdmFyIGNsYXNzZXMgPSBBcnJheS5pc0FycmF5KGNsYXNzZXMpID8gY2xhc3NlcyA6IGNsYXNzZXMuc3BsaXQoc3BhY2UpLFxyXG4gICAgICAgIGN1cnJlbnRDbGFzc2VzID0gdGFyZ2V0LmNsYXNzTGlzdCA/IG51bGwgOiB0YXJnZXQuY2xhc3NOYW1lLnNwbGl0KHNwYWNlKTtcclxuXHJcbiAgICBmb3IodmFyIGkgPSAwOyBpIDwgY2xhc3Nlcy5sZW5ndGg7IGkrKyl7XHJcbiAgICAgICAgdmFyIGNsYXNzVG9BZGQgPSBjbGFzc2VzW2ldO1xyXG4gICAgICAgIGlmKCFjbGFzc1RvQWRkIHx8IGNsYXNzVG9BZGQgPT09IHNwYWNlKXtcclxuICAgICAgICAgICAgY29udGludWU7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIGlmKHRhcmdldC5jbGFzc0xpc3Qpe1xyXG4gICAgICAgICAgICB0YXJnZXQuY2xhc3NMaXN0LmFkZChjbGFzc1RvQWRkKTtcclxuICAgICAgICB9IGVsc2UgaWYoIWN1cnJlbnRDbGFzc2VzLmluZGV4T2YoY2xhc3NUb0FkZCk+PTApe1xyXG4gICAgICAgICAgICBjdXJyZW50Q2xhc3Nlcy5wdXNoKGNsYXNzVG9BZGQpO1xyXG4gICAgICAgIH1cclxuICAgIH1cclxuICAgIGlmKCF0YXJnZXQuY2xhc3NMaXN0KXtcclxuICAgICAgICB0YXJnZXQuY2xhc3NOYW1lID0gY3VycmVudENsYXNzZXMuam9pbihzcGFjZSk7XHJcbiAgICB9XHJcbiAgICByZXR1cm4gdGhpcztcclxufVxyXG5cclxuLyoqXHJcblxyXG4gICAgIyMgLnJlbW92ZUNsYXNzXHJcblxyXG4gICAgcmVtb3ZlcyBjbGFzc2VzIGZyb20gdGhlIHRhcmdldCAoc3BhY2Ugc2VwYXJhdGVkIHN0cmluZyBvciBhcnJheSlcclxuXHJcbiAgICAgICAgLy9mbHVlbnRcclxuICAgICAgICBkb2ModGFyZ2V0KS5yZW1vdmVDbGFzcyhxdWVyeSk7XHJcblxyXG4gICAgICAgIC8vbGVnYWN5XHJcbiAgICAgICAgZG9jLnJlbW92ZUNsYXNzKHRhcmdldCwgcXVlcnkpO1xyXG4qL1xyXG5cclxuZnVuY3Rpb24gcmVtb3ZlQ2xhc3ModGFyZ2V0LCBjbGFzc2VzKXtcclxuICAgIHRhcmdldCA9IGdldFRhcmdldHModGFyZ2V0KTtcclxuXHJcbiAgICBpZihpc0xpc3QodGFyZ2V0KSl7XHJcbiAgICAgICAgZm9yICh2YXIgaSA9IDA7IGkgPCB0YXJnZXQubGVuZ3RoOyBpKyspIHtcclxuICAgICAgICAgICAgcmVtb3ZlQ2xhc3ModGFyZ2V0W2ldLCBjbGFzc2VzKTtcclxuICAgICAgICB9XHJcbiAgICAgICAgcmV0dXJuIHRoaXM7XHJcbiAgICB9XHJcblxyXG4gICAgaWYoIWNsYXNzZXMpe1xyXG4gICAgICAgIHJldHVybiB0aGlzO1xyXG4gICAgfVxyXG5cclxuICAgIHZhciBjbGFzc2VzID0gQXJyYXkuaXNBcnJheShjbGFzc2VzKSA/IGNsYXNzZXMgOiBjbGFzc2VzLnNwbGl0KHNwYWNlKSxcclxuICAgICAgICBjdXJyZW50Q2xhc3NlcyA9IHRhcmdldC5jbGFzc0xpc3QgPyBudWxsIDogdGFyZ2V0LmNsYXNzTmFtZS5zcGxpdChzcGFjZSk7XHJcblxyXG4gICAgZm9yKHZhciBpID0gMDsgaSA8IGNsYXNzZXMubGVuZ3RoOyBpKyspe1xyXG4gICAgICAgIHZhciBjbGFzc1RvUmVtb3ZlID0gY2xhc3Nlc1tpXTtcclxuICAgICAgICBpZighY2xhc3NUb1JlbW92ZSB8fCBjbGFzc1RvUmVtb3ZlID09PSBzcGFjZSl7XHJcbiAgICAgICAgICAgIGNvbnRpbnVlO1xyXG4gICAgICAgIH1cclxuICAgICAgICBpZih0YXJnZXQuY2xhc3NMaXN0KXtcclxuICAgICAgICAgICAgdGFyZ2V0LmNsYXNzTGlzdC5yZW1vdmUoY2xhc3NUb1JlbW92ZSk7XHJcbiAgICAgICAgICAgIGNvbnRpbnVlO1xyXG4gICAgICAgIH1cclxuICAgICAgICB2YXIgcmVtb3ZlSW5kZXggPSBjdXJyZW50Q2xhc3Nlcy5pbmRleE9mKGNsYXNzVG9SZW1vdmUpO1xyXG4gICAgICAgIGlmKHJlbW92ZUluZGV4ID49IDApe1xyXG4gICAgICAgICAgICBjdXJyZW50Q2xhc3Nlcy5zcGxpY2UocmVtb3ZlSW5kZXgsIDEpO1xyXG4gICAgICAgIH1cclxuICAgIH1cclxuICAgIGlmKCF0YXJnZXQuY2xhc3NMaXN0KXtcclxuICAgICAgICB0YXJnZXQuY2xhc3NOYW1lID0gY3VycmVudENsYXNzZXMuam9pbihzcGFjZSk7XHJcbiAgICB9XHJcbiAgICByZXR1cm4gdGhpcztcclxufVxyXG5cclxuZnVuY3Rpb24gYWRkRXZlbnQoc2V0dGluZ3Mpe1xyXG4gICAgdmFyIHRhcmdldCA9IGdldFRhcmdldChzZXR0aW5ncy50YXJnZXQpO1xyXG4gICAgaWYodGFyZ2V0KXtcclxuICAgICAgICB0YXJnZXQuYWRkRXZlbnRMaXN0ZW5lcihzZXR0aW5ncy5ldmVudCwgc2V0dGluZ3MuY2FsbGJhY2ssIGZhbHNlKTtcclxuICAgIH1lbHNle1xyXG4gICAgICAgIGNvbnNvbGUud2FybignTm8gZWxlbWVudHMgbWF0Y2hlZCB0aGUgc2VsZWN0b3IsIHNvIG5vIGV2ZW50cyB3ZXJlIGJvdW5kLicpO1xyXG4gICAgfVxyXG59XHJcblxyXG4vKipcclxuXHJcbiAgICAjIyAub25cclxuXHJcbiAgICBiaW5kcyBhIGNhbGxiYWNrIHRvIGEgdGFyZ2V0IHdoZW4gYSBET00gZXZlbnQgaXMgcmFpc2VkLlxyXG5cclxuICAgICAgICAvL2ZsdWVudFxyXG4gICAgICAgIGRvYyh0YXJnZXQvcHJveHkpLm9uKGV2ZW50cywgdGFyZ2V0W29wdGlvbmFsXSwgY2FsbGJhY2spO1xyXG5cclxuICAgIG5vdGU6IGlmIGEgdGFyZ2V0IGlzIHBhc3NlZCB0byB0aGUgLm9uIGZ1bmN0aW9uLCBkb2MncyB0YXJnZXQgd2lsbCBiZSB1c2VkIGFzIHRoZSBwcm94eS5cclxuXHJcbiAgICAgICAgLy9sZWdhY3lcclxuICAgICAgICBkb2Mub24oZXZlbnRzLCB0YXJnZXQsIHF1ZXJ5LCBwcm94eVtvcHRpb25hbF0pO1xyXG4qL1xyXG5cclxuZnVuY3Rpb24gb24oZXZlbnRzLCB0YXJnZXQsIGNhbGxiYWNrLCBwcm94eSl7XHJcblxyXG4gICAgcHJveHkgPSBnZXRUYXJnZXRzKHByb3h5KTtcclxuXHJcbiAgICBpZighcHJveHkpe1xyXG4gICAgICAgIHRhcmdldCA9IGdldFRhcmdldHModGFyZ2V0KTtcclxuICAgICAgICAvLyBoYW5kbGVzIG11bHRpcGxlIHRhcmdldHNcclxuICAgICAgICBpZihpc0xpc3QodGFyZ2V0KSl7XHJcbiAgICAgICAgICAgIHZhciBtdWx0aVJlbW92ZUNhbGxiYWNrcyA9IFtdO1xyXG4gICAgICAgICAgICBmb3IgKHZhciBpID0gMDsgaSA8IHRhcmdldC5sZW5ndGg7IGkrKykge1xyXG4gICAgICAgICAgICAgICAgbXVsdGlSZW1vdmVDYWxsYmFja3MucHVzaChvbihldmVudHMsIHRhcmdldFtpXSwgY2FsbGJhY2ssIHByb3h5KSk7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgcmV0dXJuIGZ1bmN0aW9uKCl7XHJcbiAgICAgICAgICAgICAgICB3aGlsZShtdWx0aVJlbW92ZUNhbGxiYWNrcy5sZW5ndGgpe1xyXG4gICAgICAgICAgICAgICAgICAgIG11bHRpUmVtb3ZlQ2FsbGJhY2tzLnBvcCgpO1xyXG4gICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICB9O1xyXG4gICAgICAgIH1cclxuICAgIH1cclxuXHJcbiAgICAvLyBoYW5kbGVzIG11bHRpcGxlIHByb3hpZXNcclxuICAgIC8vIEFscmVhZHkgaGFuZGxlcyBtdWx0aXBsZSBwcm94aWVzIGFuZCB0YXJnZXRzLFxyXG4gICAgLy8gYmVjYXVzZSB0aGUgdGFyZ2V0IGxvb3AgY2FsbHMgdGhpcyBsb29wLlxyXG4gICAgaWYoaXNMaXN0KHByb3h5KSl7XHJcbiAgICAgICAgdmFyIG11bHRpUmVtb3ZlQ2FsbGJhY2tzID0gW107XHJcbiAgICAgICAgZm9yICh2YXIgaSA9IDA7IGkgPCBwcm94eS5sZW5ndGg7IGkrKykge1xyXG4gICAgICAgICAgICBtdWx0aVJlbW92ZUNhbGxiYWNrcy5wdXNoKG9uKGV2ZW50cywgdGFyZ2V0LCBjYWxsYmFjaywgcHJveHlbaV0pKTtcclxuICAgICAgICB9XHJcbiAgICAgICAgcmV0dXJuIGZ1bmN0aW9uKCl7XHJcbiAgICAgICAgICAgIHdoaWxlKG11bHRpUmVtb3ZlQ2FsbGJhY2tzLmxlbmd0aCl7XHJcbiAgICAgICAgICAgICAgICBtdWx0aVJlbW92ZUNhbGxiYWNrcy5wb3AoKTtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgIH07XHJcbiAgICB9XHJcblxyXG4gICAgdmFyIHJlbW92ZUNhbGxiYWNrcyA9IFtdO1xyXG5cclxuICAgIGlmKHR5cGVvZiBldmVudHMgPT09ICdzdHJpbmcnKXtcclxuICAgICAgICBldmVudHMgPSBldmVudHMuc3BsaXQoc3BhY2UpO1xyXG4gICAgfVxyXG5cclxuICAgIGZvcih2YXIgaSA9IDA7IGkgPCBldmVudHMubGVuZ3RoOyBpKyspe1xyXG4gICAgICAgIHZhciBldmVudFNldHRpbmdzID0ge307XHJcbiAgICAgICAgaWYocHJveHkpe1xyXG4gICAgICAgICAgICBpZihwcm94eSA9PT0gdHJ1ZSl7XHJcbiAgICAgICAgICAgICAgICBwcm94eSA9IGRvYy5kb2N1bWVudDtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICBldmVudFNldHRpbmdzLnRhcmdldCA9IHByb3h5O1xyXG4gICAgICAgICAgICBldmVudFNldHRpbmdzLmNhbGxiYWNrID0gZnVuY3Rpb24oZXZlbnQpe1xyXG4gICAgICAgICAgICAgICAgdmFyIGNsb3Nlc3RUYXJnZXQgPSBjbG9zZXN0KGV2ZW50LnRhcmdldCwgdGFyZ2V0KTtcclxuICAgICAgICAgICAgICAgIGlmKGNsb3Nlc3RUYXJnZXQpe1xyXG4gICAgICAgICAgICAgICAgICAgIGNhbGxiYWNrKGV2ZW50LCBjbG9zZXN0VGFyZ2V0KTtcclxuICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgfTtcclxuICAgICAgICB9ZWxzZXtcclxuICAgICAgICAgICAgZXZlbnRTZXR0aW5ncy50YXJnZXQgPSB0YXJnZXQ7XHJcbiAgICAgICAgICAgIGV2ZW50U2V0dGluZ3MuY2FsbGJhY2sgPSBjYWxsYmFjaztcclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIGV2ZW50U2V0dGluZ3MuZXZlbnQgPSBldmVudHNbaV07XHJcblxyXG4gICAgICAgIGFkZEV2ZW50KGV2ZW50U2V0dGluZ3MpO1xyXG5cclxuICAgICAgICByZW1vdmVDYWxsYmFja3MucHVzaChldmVudFNldHRpbmdzKTtcclxuICAgIH1cclxuXHJcbiAgICByZXR1cm4gZnVuY3Rpb24oKXtcclxuICAgICAgICB3aGlsZShyZW1vdmVDYWxsYmFja3MubGVuZ3RoKXtcclxuICAgICAgICAgICAgdmFyIHJlbW92ZUNhbGxiYWNrID0gcmVtb3ZlQ2FsbGJhY2tzLnBvcCgpO1xyXG4gICAgICAgICAgICBnZXRUYXJnZXQocmVtb3ZlQ2FsbGJhY2sudGFyZ2V0KS5yZW1vdmVFdmVudExpc3RlbmVyKHJlbW92ZUNhbGxiYWNrLmV2ZW50LCByZW1vdmVDYWxsYmFjay5jYWxsYmFjayk7XHJcbiAgICAgICAgfVxyXG4gICAgfVxyXG59XHJcblxyXG4vKipcclxuXHJcbiAgICAjIyAub2ZmXHJcblxyXG4gICAgcmVtb3ZlcyBldmVudHMgYXNzaWduZWQgdG8gYSB0YXJnZXQuXHJcblxyXG4gICAgICAgIC8vZmx1ZW50XHJcbiAgICAgICAgZG9jKHRhcmdldC9wcm94eSkub2ZmKGV2ZW50cywgdGFyZ2V0W29wdGlvbmFsXSwgY2FsbGJhY2spO1xyXG5cclxuICAgIG5vdGU6IGlmIGEgdGFyZ2V0IGlzIHBhc3NlZCB0byB0aGUgLm9uIGZ1bmN0aW9uLCBkb2MncyB0YXJnZXQgd2lsbCBiZSB1c2VkIGFzIHRoZSBwcm94eS5cclxuXHJcbiAgICAgICAgLy9sZWdhY3lcclxuICAgICAgICBkb2Mub2ZmKGV2ZW50cywgdGFyZ2V0LCBjYWxsYmFjaywgcHJveHkpO1xyXG4qL1xyXG5cclxuZnVuY3Rpb24gb2ZmKGV2ZW50cywgdGFyZ2V0LCBjYWxsYmFjaywgcHJveHkpe1xyXG4gICAgaWYoaXNMaXN0KHRhcmdldCkpe1xyXG4gICAgICAgIGZvciAodmFyIGkgPSAwOyBpIDwgdGFyZ2V0Lmxlbmd0aDsgaSsrKSB7XHJcbiAgICAgICAgICAgIG9mZihldmVudHMsIHRhcmdldFtpXSwgY2FsbGJhY2ssIHByb3h5KTtcclxuICAgICAgICB9XHJcbiAgICAgICAgcmV0dXJuIHRoaXM7XHJcbiAgICB9XHJcbiAgICBpZihwcm94eSBpbnN0YW5jZW9mIEFycmF5KXtcclxuICAgICAgICBmb3IgKHZhciBpID0gMDsgaSA8IHByb3h5Lmxlbmd0aDsgaSsrKSB7XHJcbiAgICAgICAgICAgIG9mZihldmVudHMsIHRhcmdldCwgY2FsbGJhY2ssIHByb3h5W2ldKTtcclxuICAgICAgICB9XHJcbiAgICAgICAgcmV0dXJuIHRoaXM7XHJcbiAgICB9XHJcblxyXG4gICAgaWYodHlwZW9mIGV2ZW50cyA9PT0gJ3N0cmluZycpe1xyXG4gICAgICAgIGV2ZW50cyA9IGV2ZW50cy5zcGxpdChzcGFjZSk7XHJcbiAgICB9XHJcblxyXG4gICAgaWYodHlwZW9mIGNhbGxiYWNrICE9PSAnZnVuY3Rpb24nKXtcclxuICAgICAgICBwcm94eSA9IGNhbGxiYWNrO1xyXG4gICAgICAgIGNhbGxiYWNrID0gbnVsbDtcclxuICAgIH1cclxuXHJcbiAgICBwcm94eSA9IHByb3h5ID8gZ2V0VGFyZ2V0KHByb3h5KSA6IGRvYy5kb2N1bWVudDtcclxuXHJcbiAgICB2YXIgdGFyZ2V0cyA9IHR5cGVvZiB0YXJnZXQgPT09ICdzdHJpbmcnID8gZmluZCh0YXJnZXQsIHByb3h5KSA6IFt0YXJnZXRdO1xyXG5cclxuICAgIGZvcih2YXIgdGFyZ2V0SW5kZXggPSAwOyB0YXJnZXRJbmRleCA8IHRhcmdldHMubGVuZ3RoOyB0YXJnZXRJbmRleCsrKXtcclxuICAgICAgICB2YXIgY3VycmVudFRhcmdldCA9IHRhcmdldHNbdGFyZ2V0SW5kZXhdO1xyXG5cclxuICAgICAgICBmb3IodmFyIGkgPSAwOyBpIDwgZXZlbnRzLmxlbmd0aDsgaSsrKXtcclxuICAgICAgICAgICAgY3VycmVudFRhcmdldC5yZW1vdmVFdmVudExpc3RlbmVyKGV2ZW50c1tpXSwgY2FsbGJhY2spO1xyXG4gICAgICAgIH1cclxuICAgIH1cclxuICAgIHJldHVybiB0aGlzO1xyXG59XHJcblxyXG4vKipcclxuXHJcbiAgICAjIyAuYXBwZW5kXHJcblxyXG4gICAgYWRkcyBlbGVtZW50cyB0byBhIHRhcmdldFxyXG5cclxuICAgICAgICAvL2ZsdWVudFxyXG4gICAgICAgIGRvYyh0YXJnZXQpLmFwcGVuZChjaGlsZHJlbik7XHJcblxyXG4gICAgICAgIC8vbGVnYWN5XHJcbiAgICAgICAgZG9jLmFwcGVuZCh0YXJnZXQsIGNoaWxkcmVuKTtcclxuKi9cclxuXHJcbmZ1bmN0aW9uIGFwcGVuZCh0YXJnZXQsIGNoaWxkcmVuKXtcclxuICAgIHZhciB0YXJnZXQgPSBnZXRUYXJnZXQodGFyZ2V0KSxcclxuICAgICAgICBjaGlsZHJlbiA9IGdldFRhcmdldChjaGlsZHJlbik7XHJcblxyXG4gICAgaWYoaXNMaXN0KHRhcmdldCkpe1xyXG4gICAgICAgIHRhcmdldCA9IHRhcmdldFswXTtcclxuICAgIH1cclxuXHJcbiAgICBpZihpc0xpc3QoY2hpbGRyZW4pKXtcclxuICAgICAgICBmb3IgKHZhciBpID0gMDsgaSA8IGNoaWxkcmVuLmxlbmd0aDsgaSsrKSB7XHJcbiAgICAgICAgICAgIGFwcGVuZCh0YXJnZXQsIGNoaWxkcmVuW2ldKTtcclxuICAgICAgICB9XHJcbiAgICAgICAgcmV0dXJuO1xyXG4gICAgfVxyXG5cclxuICAgIHRhcmdldC5hcHBlbmRDaGlsZChjaGlsZHJlbik7XHJcbn1cclxuXHJcbi8qKlxyXG5cclxuICAgICMjIC5wcmVwZW5kXHJcblxyXG4gICAgYWRkcyBlbGVtZW50cyB0byB0aGUgZnJvbnQgb2YgYSB0YXJnZXRcclxuXHJcbiAgICAgICAgLy9mbHVlbnRcclxuICAgICAgICBkb2ModGFyZ2V0KS5wcmVwZW5kKGNoaWxkcmVuKTtcclxuXHJcbiAgICAgICAgLy9sZWdhY3lcclxuICAgICAgICBkb2MucHJlcGVuZCh0YXJnZXQsIGNoaWxkcmVuKTtcclxuKi9cclxuXHJcbmZ1bmN0aW9uIHByZXBlbmQodGFyZ2V0LCBjaGlsZHJlbil7XHJcbiAgICB2YXIgdGFyZ2V0ID0gZ2V0VGFyZ2V0KHRhcmdldCksXHJcbiAgICAgICAgY2hpbGRyZW4gPSBnZXRUYXJnZXQoY2hpbGRyZW4pO1xyXG5cclxuICAgIGlmKGlzTGlzdCh0YXJnZXQpKXtcclxuICAgICAgICB0YXJnZXQgPSB0YXJnZXRbMF07XHJcbiAgICB9XHJcblxyXG4gICAgaWYoaXNMaXN0KGNoaWxkcmVuKSl7XHJcbiAgICAgICAgLy9yZXZlcnNlZCBiZWNhdXNlIG90aGVyd2lzZSB0aGUgd291bGQgZ2V0IHB1dCBpbiBpbiB0aGUgd3Jvbmcgb3JkZXIuXHJcbiAgICAgICAgZm9yICh2YXIgaSA9IGNoaWxkcmVuLmxlbmd0aCAtMTsgaTsgaS0tKSB7XHJcbiAgICAgICAgICAgIHByZXBlbmQodGFyZ2V0LCBjaGlsZHJlbltpXSk7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIHJldHVybjtcclxuICAgIH1cclxuXHJcbiAgICB0YXJnZXQuaW5zZXJ0QmVmb3JlKGNoaWxkcmVuLCB0YXJnZXQuZmlyc3RDaGlsZCk7XHJcbn1cclxuXHJcbi8qKlxyXG5cclxuICAgICMjIC5pc1Zpc2libGVcclxuXHJcbiAgICBjaGVja3MgaWYgYW4gZWxlbWVudCBvciBhbnkgb2YgaXRzIHBhcmVudHMgZGlzcGxheSBwcm9wZXJ0aWVzIGFyZSBzZXQgdG8gJ25vbmUnXHJcblxyXG4gICAgICAgIC8vZmx1ZW50XHJcbiAgICAgICAgZG9jKHRhcmdldCkuaXNWaXNpYmxlKCk7XHJcblxyXG4gICAgICAgIC8vbGVnYWN5XHJcbiAgICAgICAgZG9jLmlzVmlzaWJsZSh0YXJnZXQpO1xyXG4qL1xyXG5cclxuZnVuY3Rpb24gaXNWaXNpYmxlKHRhcmdldCl7XHJcbiAgICB2YXIgdGFyZ2V0ID0gZ2V0VGFyZ2V0KHRhcmdldCk7XHJcbiAgICBpZighdGFyZ2V0KXtcclxuICAgICAgICByZXR1cm47XHJcbiAgICB9XHJcbiAgICBpZihpc0xpc3QodGFyZ2V0KSl7XHJcbiAgICAgICAgdmFyIGkgPSAtMTtcclxuXHJcbiAgICAgICAgd2hpbGUgKHRhcmdldFtpKytdICYmIGlzVmlzaWJsZSh0YXJnZXRbaV0pKSB7fVxyXG4gICAgICAgIHJldHVybiB0YXJnZXQubGVuZ3RoID49IGk7XHJcbiAgICB9XHJcbiAgICB3aGlsZSh0YXJnZXQucGFyZW50Tm9kZSAmJiB0YXJnZXQuc3R5bGUuZGlzcGxheSAhPT0gJ25vbmUnKXtcclxuICAgICAgICB0YXJnZXQgPSB0YXJnZXQucGFyZW50Tm9kZTtcclxuICAgIH1cclxuXHJcbiAgICByZXR1cm4gdGFyZ2V0ID09PSBkb2MuZG9jdW1lbnQ7XHJcbn1cclxuXHJcbi8qKlxyXG5cclxuICAgICMjIC5pbmRleE9mRWxlbWVudFxyXG5cclxuICAgIHJldHVybnMgdGhlIGluZGV4IG9mIHRoZSBlbGVtZW50IHdpdGhpbiBpdCdzIHBhcmVudCBlbGVtZW50LlxyXG5cclxuICAgICAgICAvL2ZsdWVudFxyXG4gICAgICAgIGRvYyh0YXJnZXQpLmluZGV4T2ZFbGVtZW50KCk7XHJcblxyXG4gICAgICAgIC8vbGVnYWN5XHJcbiAgICAgICAgZG9jLmluZGV4T2ZFbGVtZW50KHRhcmdldCk7XHJcblxyXG4qL1xyXG5cclxuZnVuY3Rpb24gaW5kZXhPZkVsZW1lbnQodGFyZ2V0KSB7XHJcbiAgICB0YXJnZXQgPSBnZXRUYXJnZXRzKHRhcmdldCk7XHJcbiAgICBpZighdGFyZ2V0KXtcclxuICAgICAgICByZXR1cm47XHJcbiAgICB9XHJcblxyXG4gICAgaWYoaXNMaXN0KHRhcmdldCkpe1xyXG4gICAgICAgIHRhcmdldCA9IHRhcmdldFswXTtcclxuICAgIH1cclxuXHJcbiAgICB2YXIgaSA9IC0xO1xyXG5cclxuICAgIHZhciBwYXJlbnQgPSB0YXJnZXQucGFyZW50RWxlbWVudDtcclxuXHJcbiAgICBpZighcGFyZW50KXtcclxuICAgICAgICByZXR1cm4gaTtcclxuICAgIH1cclxuXHJcbiAgICB3aGlsZShwYXJlbnQuY2hpbGRyZW5bKytpXSAhPT0gdGFyZ2V0KXt9XHJcblxyXG4gICAgcmV0dXJuIGk7XHJcbn1cclxuXHJcblxyXG4vKipcclxuXHJcbiAgICAjIyAucmVhZHlcclxuXHJcbiAgICBjYWxsIGEgY2FsbGJhY2sgd2hlbiB0aGUgZG9jdW1lbnQgaXMgcmVhZHkuXHJcblxyXG4gICAgcmV0dXJucyAtMSBpZiB0aGVyZSBpcyBubyBwYXJlbnRFbGVtZW50IG9uIHRoZSB0YXJnZXQuXHJcblxyXG4gICAgICAgIC8vZmx1ZW50XHJcbiAgICAgICAgZG9jKCkucmVhZHkoY2FsbGJhY2spO1xyXG5cclxuICAgICAgICAvL2xlZ2FjeVxyXG4gICAgICAgIGRvYy5yZWFkeShjYWxsYmFjayk7XHJcbiovXHJcblxyXG5mdW5jdGlvbiByZWFkeShjYWxsYmFjayl7XHJcbiAgICBpZihkb2MuZG9jdW1lbnQgJiYgKGRvYy5kb2N1bWVudC5yZWFkeVN0YXRlID09PSAnY29tcGxldGUnIHx8IGRvYy5kb2N1bWVudC5yZWFkeVN0YXRlID09PSAnaW50ZXJhY3RpdmUnKSl7XHJcbiAgICAgICAgY2FsbGJhY2soKTtcclxuICAgIH1lbHNlIGlmKHdpbmRvdy5hdHRhY2hFdmVudCl7XHJcbiAgICAgICAgZG9jdW1lbnQuYXR0YWNoRXZlbnQoXCJvbnJlYWR5c3RhdGVjaGFuZ2VcIiwgY2FsbGJhY2spO1xyXG4gICAgICAgIHdpbmRvdy5hdHRhY2hFdmVudChcIm9uTG9hZFwiLGNhbGxiYWNrKTtcclxuICAgIH1lbHNlIGlmKGRvY3VtZW50LmFkZEV2ZW50TGlzdGVuZXIpe1xyXG4gICAgICAgIGRvY3VtZW50LmFkZEV2ZW50TGlzdGVuZXIoXCJET01Db250ZW50TG9hZGVkXCIsY2FsbGJhY2ssZmFsc2UpO1xyXG4gICAgfVxyXG59XHJcblxyXG5kb2MuZmluZCA9IGZpbmQ7XHJcbmRvYy5maW5kT25lID0gZmluZE9uZTtcclxuZG9jLmNsb3Nlc3QgPSBjbG9zZXN0O1xyXG5kb2MuaXMgPSBpcztcclxuZG9jLmFkZENsYXNzID0gYWRkQ2xhc3M7XHJcbmRvYy5yZW1vdmVDbGFzcyA9IHJlbW92ZUNsYXNzO1xyXG5kb2Mub2ZmID0gb2ZmO1xyXG5kb2Mub24gPSBvbjtcclxuZG9jLmFwcGVuZCA9IGFwcGVuZDtcclxuZG9jLnByZXBlbmQgPSBwcmVwZW5kO1xyXG5kb2MuaXNWaXNpYmxlID0gaXNWaXNpYmxlO1xyXG5kb2MucmVhZHkgPSByZWFkeTtcclxuZG9jLmluZGV4T2ZFbGVtZW50ID0gaW5kZXhPZkVsZW1lbnQ7XHJcblxyXG5tb2R1bGUuZXhwb3J0cyA9IGRvYzsiLCJ2YXIgZG9jID0gcmVxdWlyZSgnLi9kb2MnKSxcclxuICAgIGlzTGlzdCA9IHJlcXVpcmUoJy4vaXNMaXN0JyksXHJcbiAgICBnZXRUYXJnZXRzID0gcmVxdWlyZSgnLi9nZXRUYXJnZXRzJykoZG9jLmRvY3VtZW50KSxcclxuICAgIGZsb2NQcm90byA9IFtdO1xyXG5cclxuZnVuY3Rpb24gRmxvYyhpdGVtcyl7XHJcbiAgICB0aGlzLnB1c2guYXBwbHkodGhpcywgaXRlbXMpO1xyXG59XHJcbkZsb2MucHJvdG90eXBlID0gZmxvY1Byb3RvO1xyXG5mbG9jUHJvdG8uY29uc3RydWN0b3IgPSBGbG9jO1xyXG5cclxuZnVuY3Rpb24gZmxvYyh0YXJnZXQpe1xyXG4gICAgdmFyIGluc3RhbmNlID0gZ2V0VGFyZ2V0cyh0YXJnZXQpO1xyXG5cclxuICAgIGlmKCFpc0xpc3QoaW5zdGFuY2UpKXtcclxuICAgICAgICBpZihpbnN0YW5jZSl7XHJcbiAgICAgICAgICAgIGluc3RhbmNlID0gW2luc3RhbmNlXTtcclxuICAgICAgICB9ZWxzZXtcclxuICAgICAgICAgICAgaW5zdGFuY2UgPSBbXTtcclxuICAgICAgICB9XHJcbiAgICB9XHJcbiAgICByZXR1cm4gbmV3IEZsb2MoaW5zdGFuY2UpO1xyXG59XHJcblxyXG52YXIgcmV0dXJuc1NlbGYgPSAnYWRkQ2xhc3MgcmVtb3ZlQ2xhc3MgYXBwZW5kIHByZXBlbmQnLnNwbGl0KCcgJyk7XHJcblxyXG5mb3IodmFyIGtleSBpbiBkb2Mpe1xyXG4gICAgaWYodHlwZW9mIGRvY1trZXldID09PSAnZnVuY3Rpb24nKXtcclxuICAgICAgICBmbG9jW2tleV0gPSBkb2Nba2V5XTtcclxuICAgICAgICBmbG9jUHJvdG9ba2V5XSA9IChmdW5jdGlvbihrZXkpe1xyXG4gICAgICAgICAgICB2YXIgaW5zdGFuY2UgPSB0aGlzO1xyXG4gICAgICAgICAgICAvLyBUaGlzIGlzIGFsc28gZXh0cmVtZWx5IGRvZGd5IGFuZCBmYXN0XHJcbiAgICAgICAgICAgIHJldHVybiBmdW5jdGlvbihhLGIsYyxkLGUsZil7XHJcbiAgICAgICAgICAgICAgICB2YXIgcmVzdWx0ID0gZG9jW2tleV0odGhpcywgYSxiLGMsZCxlLGYpO1xyXG5cclxuICAgICAgICAgICAgICAgIGlmKHJlc3VsdCAhPT0gZG9jICYmIGlzTGlzdChyZXN1bHQpKXtcclxuICAgICAgICAgICAgICAgICAgICByZXR1cm4gZmxvYyhyZXN1bHQpO1xyXG4gICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgaWYocmV0dXJuc1NlbGYuaW5kZXhPZihrZXkpID49MCl7XHJcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIGluc3RhbmNlO1xyXG4gICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgcmV0dXJuIHJlc3VsdDtcclxuICAgICAgICAgICAgfTtcclxuICAgICAgICB9KGtleSkpO1xyXG4gICAgfVxyXG59XHJcbmZsb2NQcm90by5vbiA9IGZ1bmN0aW9uKGV2ZW50cywgdGFyZ2V0LCBjYWxsYmFjayl7XHJcbiAgICB2YXIgcHJveHkgPSB0aGlzO1xyXG4gICAgaWYodHlwZW9mIHRhcmdldCA9PT0gJ2Z1bmN0aW9uJyl7XHJcbiAgICAgICAgY2FsbGJhY2sgPSB0YXJnZXQ7XHJcbiAgICAgICAgdGFyZ2V0ID0gdGhpcztcclxuICAgICAgICBwcm94eSA9IG51bGw7XHJcbiAgICB9XHJcbiAgICBkb2Mub24oZXZlbnRzLCB0YXJnZXQsIGNhbGxiYWNrLCBwcm94eSk7XHJcbiAgICByZXR1cm4gdGhpcztcclxufTtcclxuXHJcbmZsb2NQcm90by5vZmYgPSBmdW5jdGlvbihldmVudHMsIHRhcmdldCwgY2FsbGJhY2spe1xyXG4gICAgdmFyIHJlZmVyZW5jZSA9IHRoaXM7XHJcbiAgICBpZih0eXBlb2YgdGFyZ2V0ID09PSAnZnVuY3Rpb24nKXtcclxuICAgICAgICBjYWxsYmFjayA9IHRhcmdldDtcclxuICAgICAgICB0YXJnZXQgPSB0aGlzO1xyXG4gICAgICAgIHJlZmVyZW5jZSA9IG51bGw7XHJcbiAgICB9XHJcbiAgICBkb2Mub2ZmKGV2ZW50cywgdGFyZ2V0LCBjYWxsYmFjaywgcmVmZXJlbmNlKTtcclxuICAgIHJldHVybiB0aGlzO1xyXG59O1xyXG5cclxuZmxvY1Byb3RvLnJlYWR5ID0gZnVuY3Rpb24oY2FsbGJhY2spe1xyXG4gICAgZG9jLnJlYWR5KGNhbGxiYWNrKTtcclxuICAgIHJldHVybiB0aGlzO1xyXG59O1xyXG5cclxuZmxvY1Byb3RvLmFkZENsYXNzID0gZnVuY3Rpb24oY2xhc3NOYW1lKXtcclxuICAgIGRvYy5hZGRDbGFzcyh0aGlzLCBjbGFzc05hbWUpO1xyXG4gICAgcmV0dXJuIHRoaXM7XHJcbn07XHJcblxyXG5mbG9jUHJvdG8ucmVtb3ZlQ2xhc3MgPSBmdW5jdGlvbihjbGFzc05hbWUpe1xyXG4gICAgZG9jLnJlbW92ZUNsYXNzKHRoaXMsIGNsYXNzTmFtZSk7XHJcbiAgICByZXR1cm4gdGhpcztcclxufTtcclxuXHJcbm1vZHVsZS5leHBvcnRzID0gZmxvYzsiLCJ2YXIgc2luZ2xlSWQgPSAvXiNcXHcrJC87XG5cbm1vZHVsZS5leHBvcnRzID0gZnVuY3Rpb24oZG9jdW1lbnQpe1xuICAgIHJldHVybiBmdW5jdGlvbiBnZXRUYXJnZXQodGFyZ2V0KXtcbiAgICAgICAgaWYodHlwZW9mIHRhcmdldCA9PT0gJ3N0cmluZycpe1xuICAgICAgICAgICAgaWYoc2luZ2xlSWQuZXhlYyh0YXJnZXQpKXtcbiAgICAgICAgICAgICAgICByZXR1cm4gZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQodGFyZ2V0LnNsaWNlKDEpKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHJldHVybiBkb2N1bWVudC5xdWVyeVNlbGVjdG9yKHRhcmdldCk7XG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm4gdGFyZ2V0O1xuICAgIH07XG59OyIsIlxudmFyIHNpbmdsZUNsYXNzID0gL15cXC5cXHcrJC8sXG4gICAgc2luZ2xlSWQgPSAvXiNcXHcrJC8sXG4gICAgc2luZ2xlVGFnID0gL15cXHcrJC87XG5cbm1vZHVsZS5leHBvcnRzID0gZnVuY3Rpb24oZG9jdW1lbnQpe1xuICAgIHJldHVybiBmdW5jdGlvbiBnZXRUYXJnZXRzKHRhcmdldCl7XG4gICAgICAgIGlmKHR5cGVvZiB0YXJnZXQgPT09ICdzdHJpbmcnKXtcbiAgICAgICAgICAgIGlmKHNpbmdsZUlkLmV4ZWModGFyZ2V0KSl7XG4gICAgICAgICAgICAgICAgLy8gSWYgeW91IGhhdmUgbW9yZSB0aGFuIDEgb2YgdGhlIHNhbWUgaWQgaW4geW91ciBwYWdlLFxuICAgICAgICAgICAgICAgIC8vIHRoYXRzIHlvdXIgb3duIHN0dXBpZCBmYXVsdC5cbiAgICAgICAgICAgICAgICByZXR1cm4gW2RvY3VtZW50LmdldEVsZW1lbnRCeUlkKHRhcmdldC5zbGljZSgxKSldO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgaWYoc2luZ2xlVGFnLmV4ZWModGFyZ2V0KSl7XG4gICAgICAgICAgICAgICAgcmV0dXJuIGRvY3VtZW50LmdldEVsZW1lbnRzQnlUYWdOYW1lKHRhcmdldCk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBpZihzaW5nbGVDbGFzcy5leGVjKHRhcmdldCkpe1xuICAgICAgICAgICAgICAgIHJldHVybiBkb2N1bWVudC5nZXRFbGVtZW50c0J5Q2xhc3NOYW1lKHRhcmdldC5zbGljZSgxKSk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICByZXR1cm4gZG9jdW1lbnQucXVlcnlTZWxlY3RvckFsbCh0YXJnZXQpO1xuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIHRhcmdldDtcbiAgICB9O1xufTsiLCJtb2R1bGUuZXhwb3J0cyA9IGZ1bmN0aW9uIGlzTGlzdChvYmplY3Qpe1xyXG4gICAgcmV0dXJuIG9iamVjdCAhPSBudWxsICYmIHR5cGVvZiBvYmplY3QgPT09ICdvYmplY3QnICYmICdsZW5ndGgnIGluIG9iamVjdCAmJiAhKCdub2RlVHlwZScgaW4gb2JqZWN0KSAmJiBvYmplY3Quc2VsZiAhPSBvYmplY3Q7IC8vIGluIElFOCwgd2luZG93LnNlbGYgaXMgd2luZG93LCBidXQgaXQgaXMgbm90ID09PSB3aW5kb3csIGJ1dCBpdCBpcyA9PSB3aW5kb3cuLi4uLi4uLi4gV1RGIT9cclxufSIsInZhciBpcyA9IHJlcXVpcmUoJy4vaXMnKSxcbiAgICBHRU5FUklDID0gJ19nZW5lcmljJyxcbiAgICBFdmVudEVtaXR0ZXIgPSByZXF1aXJlKCdldmVudHMnKS5FdmVudEVtaXR0ZXIsXG4gICAgc2xpY2UgPSBBcnJheS5wcm90b3R5cGUuc2xpY2U7XG5cbmZ1bmN0aW9uIGZsYXR0ZW4oaXRlbSl7XG4gICAgcmV0dXJuIEFycmF5LmlzQXJyYXkoaXRlbSkgPyBpdGVtLnJlZHVjZShmdW5jdGlvbihyZXN1bHQsIGVsZW1lbnQpe1xuICAgICAgICBpZihlbGVtZW50ID09IG51bGwpe1xuICAgICAgICAgICAgcmV0dXJuIHJlc3VsdDtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gcmVzdWx0LmNvbmNhdChmbGF0dGVuKGVsZW1lbnQpKTtcbiAgICB9LFtdKSA6IGl0ZW07XG59XG5cbmZ1bmN0aW9uIGF0dGFjaFByb3BlcnRpZXMob2JqZWN0LCBmaXJtKXtcbiAgICBmb3IodmFyIGtleSBpbiB0aGlzLl9wcm9wZXJ0aWVzKXtcbiAgICAgICAgdGhpcy5fcHJvcGVydGllc1trZXldLmF0dGFjaChvYmplY3QsIGZpcm0pO1xuICAgIH1cbn1cblxuZnVuY3Rpb24gb25SZW5kZXIoKXtcblxuICAgIC8vIEVuc3VyZSBhbGwgYmluZGluZ3MgYXJlIHNvbWV3aGF0IGF0dGFjaGVkIGp1c3QgYmVmb3JlIHJlbmRlcmluZ1xuICAgIHRoaXMuYXR0YWNoKHVuZGVmaW5lZCwgMCk7XG5cbiAgICBmb3IodmFyIGtleSBpbiB0aGlzLl9wcm9wZXJ0aWVzKXtcbiAgICAgICAgdGhpcy5fcHJvcGVydGllc1trZXldLnVwZGF0ZSgpO1xuICAgIH1cbn1cblxuZnVuY3Rpb24gZGV0YWNoUHJvcGVydGllcyhmaXJtKXtcbiAgICBmb3IodmFyIGtleSBpbiB0aGlzLl9wcm9wZXJ0aWVzKXtcbiAgICAgICAgdGhpcy5fcHJvcGVydGllc1trZXldLmRldGFjaChmaXJtKTtcbiAgICB9XG59XG5cbmZ1bmN0aW9uIGRlc3Ryb3lQcm9wZXJ0aWVzKCl7XG4gICAgZm9yKHZhciBrZXkgaW4gdGhpcy5fcHJvcGVydGllcyl7XG4gICAgICAgIHRoaXMuX3Byb3BlcnRpZXNba2V5XS5kZXN0cm95KCk7XG4gICAgfVxufVxuXG5mdW5jdGlvbiBjbG9uZSgpe1xuICAgIHJldHVybiB0aGlzLmZhc3RuKHRoaXMuY29tcG9uZW50Ll90eXBlLCB0aGlzLmNvbXBvbmVudC5fc2V0dGluZ3MsIHRoaXMuY29tcG9uZW50Ll9jaGlsZHJlbi5maWx0ZXIoZnVuY3Rpb24oY2hpbGQpe1xuICAgICAgICAgICAgcmV0dXJuICFjaGlsZC5fdGVtcGxhdGVkO1xuICAgICAgICB9KS5tYXAoZnVuY3Rpb24oY2hpbGQpe1xuICAgICAgICAgICAgcmV0dXJuIGNoaWxkLmNsb25lKCk7XG4gICAgICAgIH0pXG4gICAgKTtcbn1cblxuZnVuY3Rpb24gZ2V0U2V0QmluZGluZyhuZXdCaW5kaW5nKXtcbiAgICBpZighYXJndW1lbnRzLmxlbmd0aCl7XG4gICAgICAgIHJldHVybiB0aGlzLmJpbmRpbmc7XG4gICAgfVxuXG4gICAgaWYoIWlzLmJpbmRpbmcobmV3QmluZGluZykpe1xuICAgICAgICBuZXdCaW5kaW5nID0gdGhpcy5mYXN0bi5iaW5kaW5nKG5ld0JpbmRpbmcpO1xuICAgIH1cblxuICAgIGlmKHRoaXMuYmluZGluZyAmJiB0aGlzLmJpbmRpbmcgIT09IG5ld0JpbmRpbmcpe1xuICAgICAgICB0aGlzLmJpbmRpbmcucmVtb3ZlTGlzdGVuZXIoJ2NoYW5nZScsIHRoaXMuZW1pdEF0dGFjaCk7XG4gICAgICAgIG5ld0JpbmRpbmcuYXR0YWNoKHRoaXMuYmluZGluZy5fbW9kZWwsIHRoaXMuYmluZGluZy5fZmlybSk7XG4gICAgfVxuXG4gICAgdGhpcy5iaW5kaW5nID0gbmV3QmluZGluZztcblxuICAgIHRoaXMuYmluZGluZy5vbignY2hhbmdlJywgdGhpcy5lbWl0QXR0YWNoKTtcbiAgICB0aGlzLmJpbmRpbmcub24oJ2RldGFjaCcsIHRoaXMuZW1pdERldGFjaCk7XG5cbiAgICB0aGlzLmVtaXRBdHRhY2goKTtcblxuICAgIHJldHVybiB0aGlzLmNvbXBvbmVudDtcbn07XG5cbmZ1bmN0aW9uIGVtaXRBdHRhY2goKXtcbiAgICB2YXIgbmV3Qm91bmQgPSB0aGlzLmJpbmRpbmcoKTtcbiAgICBpZihuZXdCb3VuZCAhPT0gdGhpcy5sYXN0Qm91bmQpe1xuICAgICAgICB0aGlzLmxhc3RCb3VuZCA9IG5ld0JvdW5kO1xuICAgICAgICB0aGlzLnNjb3BlLmF0dGFjaCh0aGlzLmxhc3RCb3VuZCk7XG4gICAgICAgIHRoaXMuY29tcG9uZW50LmVtaXQoJ2F0dGFjaCcsIHRoaXMuc2NvcGUsIDEpO1xuICAgIH1cbn1cblxuZnVuY3Rpb24gZW1pdERldGFjaCgpe1xuICAgIHRoaXMuY29tcG9uZW50LmVtaXQoJ2RldGFjaCcsIDEpO1xufVxuXG5mdW5jdGlvbiBnZXRTY29wZSgpe1xuICAgIHJldHVybiB0aGlzLnNjb3BlO1xufVxuXG5mdW5jdGlvbiBkZXN0cm95KCl7XG4gICAgaWYodGhpcy5kZXN0cm95ZWQpe1xuICAgICAgICByZXR1cm47XG4gICAgfVxuICAgIHRoaXMuZGVzdHJveWVkID0gdHJ1ZTtcblxuICAgIHRoaXMuY29tcG9uZW50XG4gICAgICAgIC5yZW1vdmVBbGxMaXN0ZW5lcnMoJ3JlbmRlcicpXG4gICAgICAgIC5yZW1vdmVBbGxMaXN0ZW5lcnMoJ2F0dGFjaCcpO1xuXG4gICAgdGhpcy5jb21wb25lbnQuZW1pdCgnZGVzdHJveScpO1xuICAgIHRoaXMuY29tcG9uZW50LmVsZW1lbnQgPSBudWxsO1xuICAgIHRoaXMuc2NvcGUuZGVzdHJveSgpO1xuICAgIHRoaXMuYmluZGluZy5kZXN0cm95KCk7XG5cbiAgICByZXR1cm4gdGhpcy5jb21wb25lbnQ7XG59XG5cbmZ1bmN0aW9uIGF0dGFjaENvbXBvbmVudChvYmplY3QsIGZpcm0pe1xuICAgIHRoaXMuYmluZGluZy5hdHRhY2gob2JqZWN0LCBmaXJtKTtcbiAgICByZXR1cm4gdGhpcy5jb21wb25lbnQ7XG59XG5cbmZ1bmN0aW9uIGRldGFjaENvbXBvbmVudChmaXJtKXtcbiAgICB0aGlzLmJpbmRpbmcuZGV0YWNoKGZpcm0pO1xuICAgIHJldHVybiB0aGlzLmNvbXBvbmVudDtcbn1cblxuZnVuY3Rpb24gaXNEZXN0cm95ZWQoKXtcbiAgICByZXR1cm4gdGhpcy5kZXN0cm95ZWQ7XG59XG5cbmZ1bmN0aW9uIHNldFByb3BlcnR5KGtleSwgcHJvcGVydHkpe1xuXG4gICAgLy8gQWRkIGEgZGVmYXVsdCBwcm9wZXJ0eSBvciB1c2UgdGhlIG9uZSBhbHJlYWR5IHRoZXJlXG4gICAgaWYoIXByb3BlcnR5KXtcbiAgICAgICAgcHJvcGVydHkgPSB0aGlzLmNvbXBvbmVudFtrZXldIHx8IHRoaXMuZmFzdG4ucHJvcGVydHkoKTtcbiAgICB9XG5cbiAgICB0aGlzLmNvbXBvbmVudFtrZXldID0gcHJvcGVydHk7XG4gICAgdGhpcy5jb21wb25lbnQuX3Byb3BlcnRpZXNba2V5XSA9IHByb3BlcnR5O1xuXG4gICAgcmV0dXJuIHRoaXMuY29tcG9uZW50O1xufVxuXG5mdW5jdGlvbiBleHRlbmRDb21wb25lbnQodHlwZSwgc2V0dGluZ3MsIGNoaWxkcmVuKXtcblxuICAgIGlmKHR5cGUgaW4gdGhpcy50eXBlcyl7XG4gICAgICAgIHJldHVybiB0aGlzLmNvbXBvbmVudDtcbiAgICB9XG5cbiAgICBpZighKHR5cGUgaW4gdGhpcy5mYXN0bi5jb21wb25lbnRzKSl7XG5cbiAgICAgICAgaWYoIShHRU5FUklDIGluIHRoaXMuZmFzdG4uY29tcG9uZW50cykpe1xuICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKCdObyBjb21wb25lbnQgb2YgdHlwZSBcIicgKyB0eXBlICsgJ1wiIGlzIGxvYWRlZCcpO1xuICAgICAgICB9XG5cbiAgICAgICAgdGhpcy5mYXN0bi5jb21wb25lbnRzLl9nZW5lcmljKHRoaXMuZmFzdG4sIHRoaXMuY29tcG9uZW50LCB0eXBlLCBzZXR0aW5ncywgY2hpbGRyZW4pO1xuXG4gICAgICAgIHRoaXMudHlwZXMuX2dlbmVyaWMgPSB0cnVlO1xuICAgIH1lbHNle1xuXG4gICAgICAgIHRoaXMuZmFzdG4uY29tcG9uZW50c1t0eXBlXSh0aGlzLmZhc3RuLCB0aGlzLmNvbXBvbmVudCwgdHlwZSwgc2V0dGluZ3MsIGNoaWxkcmVuKTtcbiAgICB9XG5cbiAgICB0aGlzLnR5cGVzW3R5cGVdID0gdHJ1ZTtcblxuICAgIHJldHVybiB0aGlzLmNvbXBvbmVudDtcbn07XG5cbmZ1bmN0aW9uIGlzVHlwZSh0eXBlKXtcbiAgICByZXR1cm4gdHlwZSBpbiB0aGlzLnR5cGVzO1xufVxuXG5mdW5jdGlvbiBGYXN0bkNvbXBvbmVudChmYXN0biwgdHlwZSwgc2V0dGluZ3MsIGNoaWxkcmVuKXtcbiAgICB2YXIgY29tcG9uZW50ID0gdGhpcztcblxuICAgIHZhciBjb21wb25lbnRTY29wZSA9IHtcbiAgICAgICAgdHlwZXM6IHt9LFxuICAgICAgICBmYXN0bjogZmFzdG4sXG4gICAgICAgIGNvbXBvbmVudDogY29tcG9uZW50LFxuICAgICAgICBiaW5kaW5nOiBmYXN0bi5iaW5kaW5nKCcuJyksXG4gICAgICAgIGRlc3Ryb3llZDogZmFsc2UsXG4gICAgICAgIHNjb3BlOiBuZXcgZmFzdG4uTW9kZWwoZmFsc2UpLFxuICAgICAgICBsYXN0Qm91bmQ6IG51bGxcbiAgICB9O1xuXG4gICAgY29tcG9uZW50U2NvcGUuZW1pdEF0dGFjaCA9IGVtaXRBdHRhY2guYmluZChjb21wb25lbnRTY29wZSk7XG4gICAgY29tcG9uZW50U2NvcGUuZW1pdERldGFjaCA9IGVtaXREZXRhY2guYmluZChjb21wb25lbnRTY29wZSk7XG4gICAgY29tcG9uZW50U2NvcGUuYmluZGluZy5fZGVmYXVsdF9iaW5kaW5nID0gdHJ1ZTtcblxuICAgIGNvbXBvbmVudC5fdHlwZSA9IHR5cGU7XG4gICAgY29tcG9uZW50Ll9wcm9wZXJ0aWVzID0ge307XG4gICAgY29tcG9uZW50Ll9zZXR0aW5ncyA9IHNldHRpbmdzIHx8IHt9O1xuICAgIGNvbXBvbmVudC5fY2hpbGRyZW4gPSBjaGlsZHJlbiA/IGZsYXR0ZW4oY2hpbGRyZW4pIDogW107XG5cbiAgICBjb21wb25lbnQuYXR0YWNoID0gYXR0YWNoQ29tcG9uZW50LmJpbmQoY29tcG9uZW50U2NvcGUpO1xuICAgIGNvbXBvbmVudC5kZXRhY2ggPSBkZXRhY2hDb21wb25lbnQuYmluZChjb21wb25lbnRTY29wZSk7XG4gICAgY29tcG9uZW50LnNjb3BlID0gZ2V0U2NvcGUuYmluZChjb21wb25lbnRTY29wZSk7XG4gICAgY29tcG9uZW50LmRlc3Ryb3kgPSBkZXN0cm95LmJpbmQoY29tcG9uZW50U2NvcGUpO1xuICAgIGNvbXBvbmVudC5kZXN0cm95ZWQgPSBpc0Rlc3Ryb3llZC5iaW5kKGNvbXBvbmVudFNjb3BlKTtcbiAgICBjb21wb25lbnQuYmluZGluZyA9IGdldFNldEJpbmRpbmcuYmluZChjb21wb25lbnRTY29wZSk7XG4gICAgY29tcG9uZW50LnNldFByb3BlcnR5ID0gc2V0UHJvcGVydHkuYmluZChjb21wb25lbnRTY29wZSk7XG4gICAgY29tcG9uZW50LmNsb25lID0gY2xvbmUuYmluZChjb21wb25lbnRTY29wZSk7XG4gICAgY29tcG9uZW50LmNoaWxkcmVuID0gc2xpY2UuYmluZChjb21wb25lbnQuX2NoaWxkcmVuKTtcbiAgICBjb21wb25lbnQuZXh0ZW5kID0gZXh0ZW5kQ29tcG9uZW50LmJpbmQoY29tcG9uZW50U2NvcGUpO1xuICAgIGNvbXBvbmVudC5pcyA9IGlzVHlwZS5iaW5kKGNvbXBvbmVudFNjb3BlKTtcblxuICAgIGNvbXBvbmVudC5iaW5kaW5nKGNvbXBvbmVudFNjb3BlLmJpbmRpbmcpO1xuXG4gICAgY29tcG9uZW50Lm9uKCdhdHRhY2gnLCBhdHRhY2hQcm9wZXJ0aWVzLmJpbmQodGhpcykpO1xuICAgIGNvbXBvbmVudC5vbigncmVuZGVyJywgb25SZW5kZXIuYmluZCh0aGlzKSk7XG4gICAgY29tcG9uZW50Lm9uKCdkZXRhY2gnLCBkZXRhY2hQcm9wZXJ0aWVzLmJpbmQodGhpcykpO1xuICAgIGNvbXBvbmVudC5vbignZGVzdHJveScsIGRlc3Ryb3lQcm9wZXJ0aWVzLmJpbmQodGhpcykpO1xuXG4gICAgaWYoZmFzdG4uZGVidWcpe1xuICAgICAgICBjb21wb25lbnQub24oJ3JlbmRlcicsIGZ1bmN0aW9uKCl7XG4gICAgICAgICAgICBpZihjb21wb25lbnQuZWxlbWVudCAmJiB0eXBlb2YgY29tcG9uZW50LmVsZW1lbnQgPT09ICdvYmplY3QnKXtcbiAgICAgICAgICAgICAgICBjb21wb25lbnQuZWxlbWVudC5fY29tcG9uZW50ID0gY29tcG9uZW50O1xuICAgICAgICAgICAgfVxuICAgICAgICB9KTtcbiAgICB9XG59XG5GYXN0bkNvbXBvbmVudC5wcm90b3R5cGUgPSBPYmplY3QuY3JlYXRlKEV2ZW50RW1pdHRlci5wcm90b3R5cGUpO1xuRmFzdG5Db21wb25lbnQucHJvdG90eXBlLmNvbnN0cnVjdG9yID0gRmFzdG5Db21wb25lbnQ7XG5GYXN0bkNvbXBvbmVudC5wcm90b3R5cGUuX2Zhc3RuX2NvbXBvbmVudCA9IHRydWU7XG5cbm1vZHVsZS5leHBvcnRzID0gRmFzdG5Db21wb25lbnQ7IiwidmFyIEVudGkgPSByZXF1aXJlKCdlbnRpJyksXG4gICAgaXMgPSByZXF1aXJlKCcuL2lzJyksXG4gICAgZmlybWVyID0gcmVxdWlyZSgnLi9maXJtZXInKSxcbiAgICBmdW5jdGlvbkVtaXR0ZXIgPSByZXF1aXJlKCcuL2Z1bmN0aW9uRW1pdHRlcicpLFxuICAgIHNldFByb3RvdHlwZU9mID0gcmVxdWlyZSgnc2V0cHJvdG90eXBlb2YnKSxcbiAgICBzYW1lID0gcmVxdWlyZSgnc2FtZS12YWx1ZScpO1xuXG5mdW5jdGlvbiBmdXNlQmluZGluZygpe1xuICAgIHZhciBhcmdzID0gQXJyYXkucHJvdG90eXBlLnNsaWNlLmNhbGwoYXJndW1lbnRzKTtcblxuICAgIHZhciBiaW5kaW5ncyA9IGFyZ3Muc2xpY2UoKSxcbiAgICAgICAgdHJhbnNmb3JtID0gYmluZGluZ3MucG9wKCksXG4gICAgICAgIHVwZGF0ZVRyYW5zZm9ybSxcbiAgICAgICAgcmVzdWx0QmluZGluZyA9IGNyZWF0ZUJpbmRpbmcoJ3Jlc3VsdCcpLFxuICAgICAgICBzZWxmQ2hhbmdpbmc7XG5cbiAgICByZXN1bHRCaW5kaW5nLl9hcmd1bWVudHMgPSBhcmdzO1xuXG4gICAgaWYodHlwZW9mIGJpbmRpbmdzW2JpbmRpbmdzLmxlbmd0aC0xXSA9PT0gJ2Z1bmN0aW9uJyAmJiAhaXMuYmluZGluZyhiaW5kaW5nc1tiaW5kaW5ncy5sZW5ndGgtMV0pKXtcbiAgICAgICAgdXBkYXRlVHJhbnNmb3JtID0gdHJhbnNmb3JtO1xuICAgICAgICB0cmFuc2Zvcm0gPSBiaW5kaW5ncy5wb3AoKTtcbiAgICB9XG5cbiAgICByZXN1bHRCaW5kaW5nLl9tb2RlbC5yZW1vdmVBbGxMaXN0ZW5lcnMoKTtcbiAgICByZXN1bHRCaW5kaW5nLl9zZXQgPSBmdW5jdGlvbih2YWx1ZSl7XG4gICAgICAgIGlmKHVwZGF0ZVRyYW5zZm9ybSl7XG4gICAgICAgICAgICBzZWxmQ2hhbmdpbmcgPSB0cnVlO1xuICAgICAgICAgICAgdmFyIG5ld1ZhbHVlID0gdXBkYXRlVHJhbnNmb3JtKHZhbHVlKTtcbiAgICAgICAgICAgIGlmKCFzYW1lKG5ld1ZhbHVlLCBiaW5kaW5nc1swXSgpKSl7XG4gICAgICAgICAgICAgICAgYmluZGluZ3NbMF0obmV3VmFsdWUpO1xuICAgICAgICAgICAgICAgIHJlc3VsdEJpbmRpbmcuX2NoYW5nZShuZXdWYWx1ZSk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBzZWxmQ2hhbmdpbmcgPSBmYWxzZTtcbiAgICAgICAgfWVsc2V7XG4gICAgICAgICAgICByZXN1bHRCaW5kaW5nLl9jaGFuZ2UodmFsdWUpO1xuICAgICAgICB9XG4gICAgfTtcblxuICAgIGZ1bmN0aW9uIGNoYW5nZSgpe1xuICAgICAgICBpZihzZWxmQ2hhbmdpbmcpe1xuICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG4gICAgICAgIHJlc3VsdEJpbmRpbmcodHJhbnNmb3JtLmFwcGx5KG51bGwsIGJpbmRpbmdzLm1hcChmdW5jdGlvbihiaW5kaW5nKXtcbiAgICAgICAgICAgIHJldHVybiBiaW5kaW5nKCk7XG4gICAgICAgIH0pKSk7XG4gICAgfVxuXG4gICAgYmluZGluZ3MuZm9yRWFjaChmdW5jdGlvbihiaW5kaW5nLCBpbmRleCl7XG4gICAgICAgIGlmKCFpcy5iaW5kaW5nKGJpbmRpbmcpKXtcbiAgICAgICAgICAgIGJpbmRpbmcgPSBjcmVhdGVCaW5kaW5nKGJpbmRpbmcpO1xuICAgICAgICAgICAgYmluZGluZ3Muc3BsaWNlKGluZGV4LDEsYmluZGluZyk7XG4gICAgICAgIH1cbiAgICAgICAgYmluZGluZy5vbignY2hhbmdlJywgY2hhbmdlKTtcbiAgICAgICAgcmVzdWx0QmluZGluZy5vbignZGV0YWNoJywgYmluZGluZy5kZXRhY2gpO1xuICAgIH0pO1xuXG4gICAgdmFyIGxhc3RBdHRhY2hlZDtcbiAgICByZXN1bHRCaW5kaW5nLm9uKCdhdHRhY2gnLCBmdW5jdGlvbihvYmplY3Qpe1xuICAgICAgICBzZWxmQ2hhbmdpbmcgPSB0cnVlO1xuICAgICAgICBiaW5kaW5ncy5mb3JFYWNoKGZ1bmN0aW9uKGJpbmRpbmcpe1xuICAgICAgICAgICAgYmluZGluZy5hdHRhY2gob2JqZWN0LCAxKTtcbiAgICAgICAgfSk7XG4gICAgICAgIHNlbGZDaGFuZ2luZyA9IGZhbHNlO1xuICAgICAgICBpZihsYXN0QXR0YWNoZWQgIT09IG9iamVjdCl7XG4gICAgICAgICAgICBjaGFuZ2UoKTtcbiAgICAgICAgfVxuICAgICAgICBsYXN0QXR0YWNoZWQgPSBvYmplY3Q7XG4gICAgfSk7XG5cbiAgICByZXR1cm4gcmVzdWx0QmluZGluZztcbn1cblxuZnVuY3Rpb24gY3JlYXRlVmFsdWVCaW5kaW5nKCl7XG4gICAgdmFyIHZhbHVlQmluZGluZyA9IGNyZWF0ZUJpbmRpbmcoJ3ZhbHVlJyk7XG4gICAgdmFsdWVCaW5kaW5nLmF0dGFjaCA9IGZ1bmN0aW9uKCl7cmV0dXJuIHZhbHVlQmluZGluZzt9O1xuICAgIHZhbHVlQmluZGluZy5kZXRhY2ggPSBmdW5jdGlvbigpe3JldHVybiB2YWx1ZUJpbmRpbmc7fTtcbiAgICByZXR1cm4gdmFsdWVCaW5kaW5nO1xufVxuXG5mdW5jdGlvbiBiaW5kaW5nVGVtcGxhdGUobmV3VmFsdWUpe1xuICAgIGlmKCFhcmd1bWVudHMubGVuZ3RoKXtcbiAgICAgICAgcmV0dXJuIHRoaXMudmFsdWU7XG4gICAgfVxuXG4gICAgaWYodGhpcy5iaW5kaW5nLl9mYXN0bl9iaW5kaW5nID09PSAnLicpe1xuICAgICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgdGhpcy5iaW5kaW5nLl9zZXQobmV3VmFsdWUpO1xuICAgIHJldHVybiB0aGlzLmJpbmRpbmc7XG59XG5cbmZ1bmN0aW9uIGNyZWF0ZUJpbmRpbmcocGF0aCwgbW9yZSl7XG5cbiAgICBpZihtb3JlKXsgLy8gdXNlZCBpbnN0ZWFkIG9mIGFyZ3VtZW50cy5sZW5ndGggZm9yIHBlcmZvcm1hbmNlXG4gICAgICAgIHJldHVybiBmdXNlQmluZGluZy5hcHBseShudWxsLCBhcmd1bWVudHMpO1xuICAgIH1cblxuICAgIGlmKHBhdGggPT0gbnVsbCl7XG4gICAgICAgIHJldHVybiBjcmVhdGVWYWx1ZUJpbmRpbmcoKTtcbiAgICB9XG5cbiAgICB2YXIgYmluZGluZ1Njb3BlID0ge30sXG4gICAgICAgIGJpbmRpbmcgPSBiaW5kaW5nU2NvcGUuYmluZGluZyA9IGJpbmRpbmdUZW1wbGF0ZS5iaW5kKGJpbmRpbmdTY29wZSksXG4gICAgICAgIGRlc3Ryb3llZDtcblxuICAgIHNldFByb3RvdHlwZU9mKGJpbmRpbmcsIGZ1bmN0aW9uRW1pdHRlcik7XG4gICAgYmluZGluZy5zZXRNYXhMaXN0ZW5lcnMoMTAwMDApO1xuICAgIGJpbmRpbmcuX2FyZ3VtZW50cyA9IFtwYXRoXTtcbiAgICBiaW5kaW5nLl9tb2RlbCA9IG5ldyBFbnRpKGZhbHNlKTtcbiAgICBiaW5kaW5nLl9mYXN0bl9iaW5kaW5nID0gcGF0aDtcbiAgICBiaW5kaW5nLl9maXJtID0gLUluZmluaXR5O1xuXG4gICAgZnVuY3Rpb24gbW9kZWxBdHRhY2hIYW5kbGVyKGRhdGEpe1xuICAgICAgICBiaW5kaW5nLl9tb2RlbC5hdHRhY2goZGF0YSk7XG4gICAgICAgIGJpbmRpbmcuX2NoYW5nZShiaW5kaW5nLl9tb2RlbC5nZXQocGF0aCkpO1xuICAgICAgICBiaW5kaW5nLmVtaXQoJ2F0dGFjaCcsIGRhdGEsIDEpO1xuICAgIH1cblxuICAgIGZ1bmN0aW9uIG1vZGVsRGV0YWNoSGFuZGxlcigpe1xuICAgICAgICBiaW5kaW5nLl9tb2RlbC5kZXRhY2goKTtcbiAgICB9XG5cbiAgICBiaW5kaW5nLmF0dGFjaCA9IGZ1bmN0aW9uKG9iamVjdCwgZmlybSl7XG5cbiAgICAgICAgLy8gSWYgdGhlIGJpbmRpbmcgaXMgYmVpbmcgYXNrZWQgdG8gYXR0YWNoIGxvb3NseSB0byBhbiBvYmplY3QsXG4gICAgICAgIC8vIGJ1dCBpdCBoYXMgYWxyZWFkeSBiZWVuIGRlZmluZWQgYXMgYmVpbmcgZmlybWx5IGF0dGFjaGVkLCBkbyBub3QgYXR0YWNoLlxuICAgICAgICBpZihmaXJtZXIoYmluZGluZywgZmlybSkpe1xuICAgICAgICAgICAgcmV0dXJuIGJpbmRpbmc7XG4gICAgICAgIH1cblxuICAgICAgICBiaW5kaW5nLl9maXJtID0gZmlybTtcblxuICAgICAgICB2YXIgaXNFbnRpID0gRW50aS5pc0VudGkob2JqZWN0KTtcblxuICAgICAgICBpZihpc0VudGkgJiYgYmluZGluZ1Njb3BlLmF0dGFjaGVkTW9kZWwgPT09IG9iamVjdCl7XG4gICAgICAgICAgICByZXR1cm4gYmluZGluZztcbiAgICAgICAgfVxuXG4gICAgICAgIGlmKGJpbmRpbmdTY29wZS5hdHRhY2hlZE1vZGVsKXtcbiAgICAgICAgICAgIGJpbmRpbmdTY29wZS5hdHRhY2hlZE1vZGVsLnJlbW92ZUxpc3RlbmVyKCdhdHRhY2gnLCBtb2RlbEF0dGFjaEhhbmRsZXIpO1xuICAgICAgICAgICAgYmluZGluZ1Njb3BlLmF0dGFjaGVkTW9kZWwucmVtb3ZlTGlzdGVuZXIoJ2RldGFjaCcsIG1vZGVsRGV0YWNoSGFuZGxlcik7XG4gICAgICAgICAgICBiaW5kaW5nU2NvcGUuYXR0YWNoZWRNb2RlbCA9IG51bGw7XG4gICAgICAgIH1cblxuICAgICAgICBpZihpc0VudGkpe1xuICAgICAgICAgICAgYmluZGluZ1Njb3BlLmF0dGFjaGVkTW9kZWwgPSBvYmplY3Q7XG4gICAgICAgICAgICBiaW5kaW5nU2NvcGUuYXR0YWNoZWRNb2RlbC5vbignYXR0YWNoJywgbW9kZWxBdHRhY2hIYW5kbGVyKTtcbiAgICAgICAgICAgIGJpbmRpbmdTY29wZS5hdHRhY2hlZE1vZGVsLm9uKCdkZXRhY2gnLCBtb2RlbERldGFjaEhhbmRsZXIpO1xuICAgICAgICAgICAgb2JqZWN0ID0gb2JqZWN0Ll9tb2RlbDtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmKCEob2JqZWN0IGluc3RhbmNlb2YgT2JqZWN0KSl7XG4gICAgICAgICAgICBvYmplY3QgPSB7fTtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmKGJpbmRpbmcuX21vZGVsLl9tb2RlbCA9PT0gb2JqZWN0KXtcbiAgICAgICAgICAgIHJldHVybiBiaW5kaW5nO1xuICAgICAgICB9XG5cbiAgICAgICAgbW9kZWxBdHRhY2hIYW5kbGVyKG9iamVjdCk7XG5cbiAgICAgICAgcmV0dXJuIGJpbmRpbmc7XG4gICAgfTtcblxuICAgIGJpbmRpbmcuZGV0YWNoID0gZnVuY3Rpb24oZmlybSl7XG4gICAgICAgIGlmKGZpcm1lcihiaW5kaW5nLCBmaXJtKSl7XG4gICAgICAgICAgICByZXR1cm4gYmluZGluZztcbiAgICAgICAgfVxuXG4gICAgICAgIGJpbmRpbmdTY29wZS52YWx1ZSA9IHVuZGVmaW5lZDtcbiAgICAgICAgaWYoYmluZGluZy5fbW9kZWwuaXNBdHRhY2hlZCgpKXtcbiAgICAgICAgICAgIGJpbmRpbmcuX21vZGVsLmRldGFjaCgpO1xuICAgICAgICB9XG4gICAgICAgIGJpbmRpbmcuZW1pdCgnZGV0YWNoJywgMSk7XG4gICAgICAgIHJldHVybiBiaW5kaW5nO1xuICAgIH07XG4gICAgYmluZGluZy5fc2V0ID0gZnVuY3Rpb24obmV3VmFsdWUpe1xuICAgICAgICBpZihzYW1lKGJpbmRpbmcuX21vZGVsLmdldChwYXRoKSwgbmV3VmFsdWUpKXtcbiAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuICAgICAgICBpZighYmluZGluZy5fbW9kZWwuaXNBdHRhY2hlZCgpKXtcbiAgICAgICAgICAgIGJpbmRpbmcuX21vZGVsLmF0dGFjaChiaW5kaW5nLl9tb2RlbC5nZXQoJy4nKSk7XG4gICAgICAgIH1cbiAgICAgICAgYmluZGluZy5fbW9kZWwuc2V0KHBhdGgsIG5ld1ZhbHVlKTtcbiAgICB9O1xuICAgIGJpbmRpbmcuX2NoYW5nZSA9IGZ1bmN0aW9uKG5ld1ZhbHVlKXtcbiAgICAgICAgYmluZGluZ1Njb3BlLnZhbHVlID0gbmV3VmFsdWU7XG4gICAgICAgIGJpbmRpbmcuZW1pdCgnY2hhbmdlJywgYmluZGluZygpKTtcbiAgICB9O1xuICAgIGJpbmRpbmcuY2xvbmUgPSBmdW5jdGlvbihrZWVwQXR0YWNobWVudCl7XG4gICAgICAgIHZhciBuZXdCaW5kaW5nID0gY3JlYXRlQmluZGluZy5hcHBseShudWxsLCBiaW5kaW5nLl9hcmd1bWVudHMpO1xuXG4gICAgICAgIGlmKGtlZXBBdHRhY2htZW50KXtcbiAgICAgICAgICAgIG5ld0JpbmRpbmcuYXR0YWNoKGJpbmRpbmdTY29wZS5hdHRhY2hlZE1vZGVsIHx8IGJpbmRpbmcuX21vZGVsLl9tb2RlbCwgYmluZGluZy5fZmlybSk7XG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm4gbmV3QmluZGluZztcbiAgICB9O1xuICAgIGJpbmRpbmcuZGVzdHJveSA9IGZ1bmN0aW9uKHNvZnQpe1xuICAgICAgICBpZihkZXN0cm95ZWQpe1xuICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG4gICAgICAgIGlmKHNvZnQgJiYgYmluZGluZy5saXN0ZW5lcnMoJ2NoYW5nZScpLmxlbmd0aCl7XG4gICAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cbiAgICAgICAgZGVzdHJveWVkID0gdHJ1ZTtcbiAgICAgICAgYmluZGluZy5lbWl0KCdkZXN0cm95Jyk7XG4gICAgICAgIGJpbmRpbmcuZGV0YWNoKCk7XG4gICAgICAgIGJpbmRpbmcuX21vZGVsLmRlc3Ryb3koKTtcbiAgICB9O1xuXG4gICAgYmluZGluZy5kZXN0cm95ZWQgPSBmdW5jdGlvbigpe1xuICAgICAgICByZXR1cm4gZGVzdHJveWVkO1xuICAgIH07XG5cbiAgICBpZihwYXRoICE9PSAnLicpe1xuICAgICAgICBiaW5kaW5nLl9tb2RlbC5vbihwYXRoLCBiaW5kaW5nLl9jaGFuZ2UpO1xuICAgIH1cblxuICAgIHJldHVybiBiaW5kaW5nO1xufVxuXG5mdW5jdGlvbiBmcm9tKHZhbHVlT3JCaW5kaW5nKXtcbiAgICBpZihpcy5iaW5kaW5nKHZhbHVlT3JCaW5kaW5nKSl7XG4gICAgICAgIHJldHVybiB2YWx1ZU9yQmluZGluZztcbiAgICB9XG5cbiAgICByZXR1cm4gY3JlYXRlQmluZGluZygpKHZhbHVlT3JCaW5kaW5nKTtcbn1cblxuY3JlYXRlQmluZGluZy5mcm9tID0gZnJvbTtcblxubW9kdWxlLmV4cG9ydHMgPSBjcmVhdGVCaW5kaW5nOyIsImZ1bmN0aW9uIGluc2VydENoaWxkKGZhc3RuLCBjb250YWluZXIsIGNoaWxkLCBpbmRleCl7XG4gICAgdmFyIGN1cnJlbnRJbmRleCA9IGNvbnRhaW5lci5fY2hpbGRyZW4uaW5kZXhPZihjaGlsZCksXG4gICAgICAgIG5ld0NvbXBvbmVudCA9IGZhc3RuLnRvQ29tcG9uZW50KGNoaWxkKTtcblxuICAgIGlmKG5ld0NvbXBvbmVudCAhPT0gY2hpbGQgJiYgfmN1cnJlbnRJbmRleCl7XG4gICAgICAgIGNvbnRhaW5lci5fY2hpbGRyZW4uc3BsaWNlKGN1cnJlbnRJbmRleCwgMSwgbmV3Q29tcG9uZW50KTtcbiAgICB9XG5cbiAgICBpZighfmN1cnJlbnRJbmRleCB8fCBuZXdDb21wb25lbnQgIT09IGNoaWxkKXtcbiAgICAgICAgbmV3Q29tcG9uZW50LmF0dGFjaChjb250YWluZXIuc2NvcGUoKSwgMSk7XG4gICAgfVxuXG4gICAgaWYoY3VycmVudEluZGV4ICE9PSBpbmRleCl7XG4gICAgICAgIGlmKH5jdXJyZW50SW5kZXgpe1xuICAgICAgICAgICAgY29udGFpbmVyLl9jaGlsZHJlbi5zcGxpY2UoY3VycmVudEluZGV4LCAxKTtcbiAgICAgICAgfVxuICAgICAgICBjb250YWluZXIuX2NoaWxkcmVuLnNwbGljZShpbmRleCwgMCwgbmV3Q29tcG9uZW50KTtcbiAgICB9XG5cbiAgICBpZihjb250YWluZXIuZWxlbWVudCl7XG4gICAgICAgIGlmKCFuZXdDb21wb25lbnQuZWxlbWVudCl7XG4gICAgICAgICAgICBuZXdDb21wb25lbnQucmVuZGVyKCk7XG4gICAgICAgIH1cbiAgICAgICAgY29udGFpbmVyLl9pbnNlcnQobmV3Q29tcG9uZW50LmVsZW1lbnQsIGluZGV4KTtcbiAgICAgICAgbmV3Q29tcG9uZW50LmVtaXQoJ2luc2VydCcsIGNvbnRhaW5lcik7XG4gICAgICAgIGNvbnRhaW5lci5lbWl0KCdjaGlsZEluc2VydCcsIG5ld0NvbXBvbmVudCk7XG4gICAgfVxufVxuXG5mdW5jdGlvbiBnZXRDb250YWluZXJFbGVtZW50KCl7XG4gICAgcmV0dXJuIHRoaXMuY29udGFpbmVyRWxlbWVudCB8fCB0aGlzLmVsZW1lbnQ7XG59XG5cbmZ1bmN0aW9uIGluc2VydChjaGlsZCwgaW5kZXgpe1xuICAgIHZhciBjaGlsZENvbXBvbmVudCA9IGNoaWxkLFxuICAgICAgICBjb250YWluZXIgPSB0aGlzLmNvbnRhaW5lcixcbiAgICAgICAgZmFzdG4gPSB0aGlzLmZhc3RuO1xuXG4gICAgaWYoaW5kZXggJiYgdHlwZW9mIGluZGV4ID09PSAnb2JqZWN0Jyl7XG4gICAgICAgIGNoaWxkQ29tcG9uZW50ID0gQXJyYXkucHJvdG90eXBlLnNsaWNlLmNhbGwoYXJndW1lbnRzKTtcbiAgICB9XG5cbiAgICBpZihpc05hTihpbmRleCkpe1xuICAgICAgICBpbmRleCA9IGNvbnRhaW5lci5fY2hpbGRyZW4ubGVuZ3RoO1xuICAgIH1cblxuICAgIGlmKEFycmF5LmlzQXJyYXkoY2hpbGRDb21wb25lbnQpKXtcbiAgICAgICAgZm9yICh2YXIgaSA9IDA7IGkgPCBjaGlsZENvbXBvbmVudC5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgY29udGFpbmVyLmluc2VydChjaGlsZENvbXBvbmVudFtpXSwgaSArIGluZGV4KTtcbiAgICAgICAgfVxuICAgIH1lbHNle1xuICAgICAgICBpbnNlcnRDaGlsZChmYXN0biwgY29udGFpbmVyLCBjaGlsZENvbXBvbmVudCwgaW5kZXgpO1xuICAgIH1cblxuICAgIHJldHVybiBjb250YWluZXI7XG59XG5cbm1vZHVsZS5leHBvcnRzID0gZnVuY3Rpb24oZmFzdG4sIGNvbXBvbmVudCwgdHlwZSwgc2V0dGluZ3MsIGNoaWxkcmVuKXtcbiAgICBjb21wb25lbnQuaW5zZXJ0ID0gaW5zZXJ0LmJpbmQoe1xuICAgICAgICBjb250YWluZXI6IGNvbXBvbmVudCxcbiAgICAgICAgZmFzdG46IGZhc3RuXG4gICAgfSk7XG5cbiAgICBjb21wb25lbnQuX2luc2VydCA9IGZ1bmN0aW9uKGVsZW1lbnQsIGluZGV4KXtcbiAgICAgICAgdmFyIGNvbnRhaW5lckVsZW1lbnQgPSBjb21wb25lbnQuZ2V0Q29udGFpbmVyRWxlbWVudCgpO1xuICAgICAgICBpZighY29udGFpbmVyRWxlbWVudCl7XG4gICAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cblxuICAgICAgICBpZihjb250YWluZXJFbGVtZW50LmNoaWxkTm9kZXNbaW5kZXhdID09PSBlbGVtZW50KXtcbiAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuXG4gICAgICAgIGNvbnRhaW5lckVsZW1lbnQuaW5zZXJ0QmVmb3JlKGVsZW1lbnQsIGNvbnRhaW5lckVsZW1lbnQuY2hpbGROb2Rlc1tpbmRleF0pO1xuICAgIH07XG5cbiAgICBjb21wb25lbnQucmVtb3ZlID0gZnVuY3Rpb24oY2hpbGRDb21wb25lbnQpe1xuICAgICAgICB2YXIgaW5kZXggPSBjb21wb25lbnQuX2NoaWxkcmVuLmluZGV4T2YoY2hpbGRDb21wb25lbnQpO1xuICAgICAgICBpZih+aW5kZXgpe1xuICAgICAgICAgICAgY29tcG9uZW50Ll9jaGlsZHJlbi5zcGxpY2UoaW5kZXgsMSk7XG4gICAgICAgIH1cblxuICAgICAgICBjaGlsZENvbXBvbmVudC5kZXRhY2goMSk7XG5cbiAgICAgICAgaWYoY2hpbGRDb21wb25lbnQuZWxlbWVudCl7XG4gICAgICAgICAgICBjb21wb25lbnQuX3JlbW92ZShjaGlsZENvbXBvbmVudC5lbGVtZW50KTtcbiAgICAgICAgICAgIGNoaWxkQ29tcG9uZW50LmVtaXQoJ3JlbW92ZScsIGNvbXBvbmVudCk7XG4gICAgICAgIH1cbiAgICAgICAgY29tcG9uZW50LmVtaXQoJ2NoaWxkUmVtb3ZlJywgY2hpbGRDb21wb25lbnQpO1xuICAgIH07XG5cbiAgICBjb21wb25lbnQuX3JlbW92ZSA9IGZ1bmN0aW9uKGVsZW1lbnQpe1xuICAgICAgICB2YXIgY29udGFpbmVyRWxlbWVudCA9IGNvbXBvbmVudC5nZXRDb250YWluZXJFbGVtZW50KCk7XG5cbiAgICAgICAgaWYoIWVsZW1lbnQgfHwgIWNvbnRhaW5lckVsZW1lbnQgfHwgZWxlbWVudC5wYXJlbnROb2RlICE9PSBjb250YWluZXJFbGVtZW50KXtcbiAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuXG4gICAgICAgIGNvbnRhaW5lckVsZW1lbnQucmVtb3ZlQ2hpbGQoZWxlbWVudCk7XG4gICAgfTtcblxuICAgIGNvbXBvbmVudC5lbXB0eSA9IGZ1bmN0aW9uKCl7XG4gICAgICAgIHdoaWxlKGNvbXBvbmVudC5fY2hpbGRyZW4ubGVuZ3RoKXtcbiAgICAgICAgICAgIGNvbXBvbmVudC5yZW1vdmUoY29tcG9uZW50Ll9jaGlsZHJlbi5wb3AoKSk7XG4gICAgICAgIH1cbiAgICB9O1xuXG4gICAgY29tcG9uZW50LnJlcGxhY2VDaGlsZCA9IGZ1bmN0aW9uKG9sZENoaWxkLCBuZXdDaGlsZCl7XG4gICAgICAgIHZhciBpbmRleCA9IGNvbXBvbmVudC5fY2hpbGRyZW4uaW5kZXhPZihvbGRDaGlsZCk7XG5cbiAgICAgICAgaWYoIX5pbmRleCl7XG4gICAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cblxuICAgICAgICBjb21wb25lbnQucmVtb3ZlKG9sZENoaWxkKTtcbiAgICAgICAgY29tcG9uZW50Lmluc2VydChuZXdDaGlsZCwgaW5kZXgpO1xuICAgIH07XG5cbiAgICBjb21wb25lbnQuZ2V0Q29udGFpbmVyRWxlbWVudCA9IGdldENvbnRhaW5lckVsZW1lbnQuYmluZChjb21wb25lbnQpO1xuXG4gICAgY29tcG9uZW50Lm9uKCdyZW5kZXInLCBjb21wb25lbnQuaW5zZXJ0LmJpbmQobnVsbCwgY29tcG9uZW50Ll9jaGlsZHJlbiwgMCkpO1xuXG4gICAgY29tcG9uZW50Lm9uKCdhdHRhY2gnLCBmdW5jdGlvbihtb2RlbCwgZmlybSl7XG4gICAgICAgIGZvcih2YXIgaSA9IDA7IGkgPCBjb21wb25lbnQuX2NoaWxkcmVuLmxlbmd0aDsgaSsrKXtcbiAgICAgICAgICAgIGlmKGZhc3RuLmlzQ29tcG9uZW50KGNvbXBvbmVudC5fY2hpbGRyZW5baV0pKXtcbiAgICAgICAgICAgICAgICBjb21wb25lbnQuX2NoaWxkcmVuW2ldLmF0dGFjaChtb2RlbCwgZmlybSk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9KTtcblxuICAgIGNvbXBvbmVudC5vbignZGVzdHJveScsIGZ1bmN0aW9uKGRhdGEsIGZpcm0pe1xuICAgICAgICBmb3IodmFyIGkgPSAwOyBpIDwgY29tcG9uZW50Ll9jaGlsZHJlbi5sZW5ndGg7IGkrKyl7XG4gICAgICAgICAgICBpZihmYXN0bi5pc0NvbXBvbmVudChjb21wb25lbnQuX2NoaWxkcmVuW2ldKSl7XG4gICAgICAgICAgICAgICAgY29tcG9uZW50Ll9jaGlsZHJlbltpXS5kZXN0cm95KGZpcm0pO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfSk7XG5cbiAgICByZXR1cm4gY29tcG9uZW50O1xufTsiLCJ2YXIgc2V0aWZ5ID0gcmVxdWlyZSgnc2V0aWZ5JyksXG4gICAgY2xhc3Npc3QgPSByZXF1aXJlKCdjbGFzc2lzdCcpO1xuXG5mdW5jdGlvbiB1cGRhdGVUZXh0UHJvcGVydHkoZ2VuZXJpYywgZWxlbWVudCwgdmFsdWUpe1xuICAgIGlmKGFyZ3VtZW50cy5sZW5ndGggPT09IDIpe1xuICAgICAgICByZXR1cm4gZWxlbWVudC50ZXh0Q29udGVudDtcbiAgICB9XG4gICAgZWxlbWVudC50ZXh0Q29udGVudCA9ICh2YWx1ZSA9PSBudWxsID8gJycgOiB2YWx1ZSk7XG59XG5cbm1vZHVsZS5leHBvcnRzID0ge1xuICAgIGNsYXNzOiBmdW5jdGlvbihnZW5lcmljLCBlbGVtZW50LCB2YWx1ZSl7XG4gICAgICAgIGlmKCFnZW5lcmljLl9jbGFzc2lzdCl7XG4gICAgICAgICAgICBnZW5lcmljLl9jbGFzc2lzdCA9IGNsYXNzaXN0KGVsZW1lbnQpO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYoYXJndW1lbnRzLmxlbmd0aCA8IDMpe1xuICAgICAgICAgICAgcmV0dXJuIGdlbmVyaWMuX2NsYXNzaXN0KCk7XG4gICAgICAgIH1cblxuICAgICAgICBnZW5lcmljLl9jbGFzc2lzdCh2YWx1ZSk7XG4gICAgfSxcbiAgICBkaXNwbGF5OiBmdW5jdGlvbihnZW5lcmljLCBlbGVtZW50LCB2YWx1ZSl7XG4gICAgICAgIGlmKGFyZ3VtZW50cy5sZW5ndGggPT09IDIpe1xuICAgICAgICAgICAgcmV0dXJuIGVsZW1lbnQuc3R5bGUuZGlzcGxheSAhPT0gJ25vbmUnO1xuICAgICAgICB9XG4gICAgICAgIGVsZW1lbnQuc3R5bGUuZGlzcGxheSA9IHZhbHVlID8gbnVsbCA6ICdub25lJztcbiAgICB9LFxuICAgIGRpc2FibGVkOiBmdW5jdGlvbihnZW5lcmljLCBlbGVtZW50LCB2YWx1ZSl7XG4gICAgICAgIGlmKGFyZ3VtZW50cy5sZW5ndGggPT09IDIpe1xuICAgICAgICAgICAgcmV0dXJuIGVsZW1lbnQuaGFzQXR0cmlidXRlKCdkaXNhYmxlZCcpO1xuICAgICAgICB9XG4gICAgICAgIGlmKHZhbHVlKXtcbiAgICAgICAgICAgIGVsZW1lbnQuc2V0QXR0cmlidXRlKCdkaXNhYmxlZCcsICdkaXNhYmxlZCcpO1xuICAgICAgICB9ZWxzZXtcbiAgICAgICAgICAgIGVsZW1lbnQucmVtb3ZlQXR0cmlidXRlKCdkaXNhYmxlZCcpO1xuICAgICAgICB9XG4gICAgfSxcbiAgICB0ZXh0Q29udGVudDogdXBkYXRlVGV4dFByb3BlcnR5LFxuICAgIGlubmVyVGV4dDogdXBkYXRlVGV4dFByb3BlcnR5LFxuICAgIGlubmVySFRNTDogdXBkYXRlVGV4dFByb3BlcnR5LFxuICAgIHZhbHVlOiBmdW5jdGlvbihnZW5lcmljLCBlbGVtZW50LCB2YWx1ZSl7XG4gICAgICAgIHZhciBpbnB1dFR5cGUgPSBlbGVtZW50LnR5cGU7XG5cbiAgICAgICAgaWYoZWxlbWVudC5ub2RlTmFtZSA9PT0gJ0lOUFVUJyAmJiBpbnB1dFR5cGUgPT09ICdkYXRlJyl7XG4gICAgICAgICAgICBpZihhcmd1bWVudHMubGVuZ3RoID09PSAyKXtcbiAgICAgICAgICAgICAgICByZXR1cm4gZWxlbWVudC52YWx1ZSA/IG5ldyBEYXRlKGVsZW1lbnQudmFsdWUucmVwbGFjZSgvLS9nLCcvJykucmVwbGFjZSgnVCcsJyAnKSkgOiBudWxsO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICB2YWx1ZSA9IHZhbHVlICE9IG51bGwgPyBuZXcgRGF0ZSh2YWx1ZSkgOiBudWxsO1xuXG4gICAgICAgICAgICBpZighdmFsdWUgfHwgaXNOYU4odmFsdWUpKXtcbiAgICAgICAgICAgICAgICBlbGVtZW50LnZhbHVlID0gbnVsbDtcbiAgICAgICAgICAgIH1lbHNle1xuICAgICAgICAgICAgICAgIGVsZW1lbnQudmFsdWUgPSBbXG4gICAgICAgICAgICAgICAgICAgIHZhbHVlLmdldEZ1bGxZZWFyKCksXG4gICAgICAgICAgICAgICAgICAgICgnMCcgKyAodmFsdWUuZ2V0TW9udGgoKSArIDEpKS5zbGljZSgtMiksXG4gICAgICAgICAgICAgICAgICAgICgnMCcgKyB2YWx1ZS5nZXREYXRlKCkpLnNsaWNlKC0yKVxuICAgICAgICAgICAgICAgIF0uam9pbignLScpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYoYXJndW1lbnRzLmxlbmd0aCA9PT0gMil7XG4gICAgICAgICAgICByZXR1cm4gZWxlbWVudC52YWx1ZTtcbiAgICAgICAgfVxuICAgICAgICBpZih2YWx1ZSA9PT0gdW5kZWZpbmVkKXtcbiAgICAgICAgICAgIHZhbHVlID0gbnVsbDtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmKGVsZW1lbnQubm9kZU5hbWUgPT09ICdQUk9HUkVTUycpe1xuICAgICAgICAgICAgdmFsdWUgPSBwYXJzZUZsb2F0KHZhbHVlKSB8fCAwO1xuICAgICAgICB9XG5cbiAgICAgICAgc2V0aWZ5KGVsZW1lbnQsIHZhbHVlKTtcbiAgICB9LFxuICAgIG1heDogZnVuY3Rpb24oZ2VuZXJpYywgZWxlbWVudCwgdmFsdWUpIHtcbiAgICAgICAgaWYoYXJndW1lbnRzLmxlbmd0aCA9PT0gMil7XG4gICAgICAgICAgICByZXR1cm4gZWxlbWVudC52YWx1ZTtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmKGVsZW1lbnQubm9kZU5hbWUgPT09ICdQUk9HUkVTUycpe1xuICAgICAgICAgICAgdmFsdWUgPSBwYXJzZUZsb2F0KHZhbHVlKSB8fCAwO1xuICAgICAgICB9XG5cbiAgICAgICAgZWxlbWVudC5tYXggPSB2YWx1ZTtcbiAgICB9LFxuICAgIHN0eWxlOiBmdW5jdGlvbihnZW5lcmljLCBlbGVtZW50LCB2YWx1ZSl7XG4gICAgICAgIGlmKGFyZ3VtZW50cy5sZW5ndGggPT09IDIpe1xuICAgICAgICAgICAgcmV0dXJuIGVsZW1lbnQuc3R5bGU7XG4gICAgICAgIH1cblxuICAgICAgICBmb3IodmFyIGtleSBpbiB2YWx1ZSl7XG4gICAgICAgICAgICBlbGVtZW50LnN0eWxlW2tleV0gPSB2YWx1ZVtrZXldO1xuICAgICAgICB9XG4gICAgfVxufTsiLCIvLyBJcyB0aGUgZW50aXR5IGZpcm1lciB0aGFuIHRoZSBuZXcgZmlybW5lc3Ncbm1vZHVsZS5leHBvcnRzID0gZnVuY3Rpb24oZW50aXR5LCBmaXJtKXtcbiAgICBpZihmaXJtICE9IG51bGwgJiYgKGVudGl0eS5fZmlybSA9PT0gdW5kZWZpbmVkIHx8IGZpcm0gPCBlbnRpdHkuX2Zpcm0pKXtcbiAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgfVxufTsiLCJ2YXIgRXZlbnRFbWl0dGVyID0gcmVxdWlyZSgnZXZlbnRzJykuRXZlbnRFbWl0dGVyLFxuICAgIGZ1bmN0aW9uRW1pdHRlclByb3RvdHlwZSA9IGZ1bmN0aW9uKCl7fTtcblxuZm9yKHZhciBrZXkgaW4gRXZlbnRFbWl0dGVyLnByb3RvdHlwZSl7XG4gICAgZnVuY3Rpb25FbWl0dGVyUHJvdG90eXBlW2tleV0gPSBFdmVudEVtaXR0ZXIucHJvdG90eXBlW2tleV07XG59XG5cbm1vZHVsZS5leHBvcnRzID0gZnVuY3Rpb25FbWl0dGVyUHJvdG90eXBlOyIsInZhciBjb250YWluZXJDb21wb25lbnQgPSByZXF1aXJlKCcuL2NvbnRhaW5lckNvbXBvbmVudCcpLFxuICAgIHNjaGVkdWxlID0gcmVxdWlyZSgnLi9zY2hlZHVsZScpLFxuICAgIGZhbmN5UHJvcHMgPSByZXF1aXJlKCcuL2ZhbmN5UHJvcHMnKSxcbiAgICBtYXRjaERvbUhhbmRsZXJOYW1lID0gL14oKD86ZWxcXC4pPykoW14uIF0rKSg/OlxcLihjYXB0dXJlKSk/JC8sXG4gICAgR0VORVJJQyA9ICdfZ2VuZXJpYyc7XG5cbmZ1bmN0aW9uIGNyZWF0ZVByb3BlcnRpZXMoZmFzdG4sIGNvbXBvbmVudCwgc2V0dGluZ3Mpe1xuICAgIGZvcih2YXIga2V5IGluIHNldHRpbmdzKXtcbiAgICAgICAgdmFyIHNldHRpbmcgPSBzZXR0aW5nc1trZXldO1xuXG4gICAgICAgIGlmKHR5cGVvZiBzZXR0aW5nID09PSAnZnVuY3Rpb24nICYmICFmYXN0bi5pc1Byb3BlcnR5KHNldHRpbmcpICYmICFmYXN0bi5pc0JpbmRpbmcoc2V0dGluZykpe1xuICAgICAgICAgICAgY29udGludWU7XG4gICAgICAgIH1cblxuICAgICAgICBjb21wb25lbnQuYWRkRG9tUHJvcGVydHkoa2V5KTtcbiAgICB9XG59XG5cbmZ1bmN0aW9uIGFkZERvbUhhbmRsZXIoY29tcG9uZW50LCBlbGVtZW50LCBoYW5kbGVyTmFtZSwgZXZlbnROYW1lLCBjYXB0dXJlKXtcbiAgICB2YXIgZXZlbnRQYXJ0cyA9IGhhbmRsZXJOYW1lLnNwbGl0KCcuJyk7XG5cbiAgICBpZihldmVudFBhcnRzWzBdID09PSAnb24nKXtcbiAgICAgICAgZXZlbnRQYXJ0cy5zaGlmdCgpO1xuICAgIH1cblxuICAgIHZhciBoYW5kbGVyID0gZnVuY3Rpb24oZXZlbnQpe1xuICAgICAgICAgICAgY29tcG9uZW50LmVtaXQoaGFuZGxlck5hbWUsIGV2ZW50LCBjb21wb25lbnQuc2NvcGUoKSk7XG4gICAgICAgIH07XG5cbiAgICBlbGVtZW50LmFkZEV2ZW50TGlzdGVuZXIoZXZlbnROYW1lLCBoYW5kbGVyLCBjYXB0dXJlKTtcblxuICAgIGNvbXBvbmVudC5vbignZGVzdHJveScsIGZ1bmN0aW9uKCl7XG4gICAgICAgIGVsZW1lbnQucmVtb3ZlRXZlbnRMaXN0ZW5lcihldmVudE5hbWUsIGhhbmRsZXIsIGNhcHR1cmUpO1xuICAgIH0pO1xufVxuXG5mdW5jdGlvbiBhZGREb21IYW5kbGVycyhjb21wb25lbnQsIGVsZW1lbnQsIGV2ZW50TmFtZXMpe1xuICAgIHZhciBldmVudHMgPSBldmVudE5hbWVzLnNwbGl0KCcgJyk7XG5cbiAgICBmb3IodmFyIGkgPSAwOyBpIDwgZXZlbnRzLmxlbmd0aDsgaSsrKXtcbiAgICAgICAgdmFyIGV2ZW50TmFtZSA9IGV2ZW50c1tpXSxcbiAgICAgICAgICAgIG1hdGNoID0gZXZlbnROYW1lLm1hdGNoKG1hdGNoRG9tSGFuZGxlck5hbWUpO1xuXG4gICAgICAgIGlmKCFtYXRjaCl7XG4gICAgICAgICAgICBjb250aW51ZTtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmKG1hdGNoWzFdIHx8ICdvbicgKyBtYXRjaFsyXSBpbiBlbGVtZW50KXtcbiAgICAgICAgICAgIGFkZERvbUhhbmRsZXIoY29tcG9uZW50LCBlbGVtZW50LCBldmVudE5hbWVzLCBtYXRjaFsyXSwgbWF0Y2hbM10pO1xuICAgICAgICB9XG4gICAgfVxufVxuXG5mdW5jdGlvbiBhZGRBdXRvSGFuZGxlcihjb21wb25lbnQsIGVsZW1lbnQsIGtleSwgc2V0dGluZ3Mpe1xuICAgIGlmKCFzZXR0aW5nc1trZXldKXtcbiAgICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIHZhciBhdXRvRXZlbnQgPSBzZXR0aW5nc1trZXldLnNwbGl0KCc6JyksXG4gICAgICAgIGV2ZW50TmFtZSA9IGtleS5zbGljZSgyKTtcblxuICAgIGRlbGV0ZSBzZXR0aW5nc1trZXldO1xuXG4gICAgdmFyIGhhbmRsZXIgPSBmdW5jdGlvbihldmVudCl7XG4gICAgICAgIHZhciBmYW5jeVByb3AgPSBmYW5jeVByb3BzW2F1dG9FdmVudFsxXV0sXG4gICAgICAgICAgICB2YWx1ZSA9IGZhbmN5UHJvcCA/IGZhbmN5UHJvcChjb21wb25lbnQsIGVsZW1lbnQpIDogZWxlbWVudFthdXRvRXZlbnRbMV1dO1xuXG4gICAgICAgIGNvbXBvbmVudFthdXRvRXZlbnRbMF1dKHZhbHVlKTtcbiAgICB9O1xuXG4gICAgZWxlbWVudC5hZGRFdmVudExpc3RlbmVyKGV2ZW50TmFtZSwgaGFuZGxlcik7XG5cbiAgICBjb21wb25lbnQub24oJ2Rlc3Ryb3knLCBmdW5jdGlvbigpe1xuICAgICAgICBlbGVtZW50LnJlbW92ZUV2ZW50TGlzdGVuZXIoZXZlbnROYW1lLCBoYW5kbGVyKTtcbiAgICB9KTtcbn1cblxuZnVuY3Rpb24gYWRkRG9tUHJvcGVydHkoZmFzdG4sIGtleSwgcHJvcGVydHkpe1xuICAgIHZhciBjb21wb25lbnQgPSB0aGlzO1xuXG4gICAgcHJvcGVydHkgPSBwcm9wZXJ0eSB8fCBjb21wb25lbnRba2V5XSB8fCBmYXN0bi5wcm9wZXJ0eSgpO1xuICAgIGNvbXBvbmVudC5zZXRQcm9wZXJ0eShrZXksIHByb3BlcnR5KTtcblxuICAgIGZ1bmN0aW9uIHVwZGF0ZSgpe1xuICAgICAgICB2YXIgZWxlbWVudCA9IGNvbXBvbmVudC5nZXRQcm9wZXJ0eUVsZW1lbnQoa2V5KSxcbiAgICAgICAgICAgIHZhbHVlID0gcHJvcGVydHkoKTtcblxuICAgICAgICBpZighZWxlbWVudCB8fCBjb21wb25lbnQuZGVzdHJveWVkKCkpe1xuICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG5cbiAgICAgICAgdmFyIGlzUHJvcGVydHkgPSBrZXkgaW4gZWxlbWVudCxcbiAgICAgICAgICAgIGZhbmN5UHJvcCA9IGZhbmN5UHJvcHNba2V5XSxcbiAgICAgICAgICAgIHByZXZpb3VzID0gZmFuY3lQcm9wID8gZmFuY3lQcm9wKGNvbXBvbmVudCwgZWxlbWVudCkgOiBpc1Byb3BlcnR5ID8gZWxlbWVudFtrZXldIDogZWxlbWVudC5nZXRBdHRyaWJ1dGUoa2V5KTtcblxuICAgICAgICBpZighZmFuY3lQcm9wICYmICFpc1Byb3BlcnR5ICYmIHZhbHVlID09IG51bGwpe1xuICAgICAgICAgICAgdmFsdWUgPSAnJztcbiAgICAgICAgfVxuXG4gICAgICAgIGlmKHZhbHVlICE9PSBwcmV2aW91cyl7XG4gICAgICAgICAgICBpZihmYW5jeVByb3Ape1xuICAgICAgICAgICAgICAgIGZhbmN5UHJvcChjb21wb25lbnQsIGVsZW1lbnQsIHZhbHVlKTtcbiAgICAgICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGlmKGlzUHJvcGVydHkpe1xuICAgICAgICAgICAgICAgIGVsZW1lbnRba2V5XSA9IHZhbHVlO1xuICAgICAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgaWYodHlwZW9mIHZhbHVlICE9PSAnZnVuY3Rpb24nICYmIHR5cGVvZiB2YWx1ZSAhPT0gJ29iamVjdCcpe1xuICAgICAgICAgICAgICAgIGVsZW1lbnQuc2V0QXR0cmlidXRlKGtleSwgdmFsdWUpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfVxuXG4gICAgcHJvcGVydHkudXBkYXRlcih1cGRhdGUpO1xufVxuXG5mdW5jdGlvbiBvblJlbmRlcigpe1xuICAgIHZhciBjb21wb25lbnQgPSB0aGlzLFxuICAgICAgICBlbGVtZW50O1xuXG4gICAgZm9yKHZhciBrZXkgaW4gY29tcG9uZW50Ll9zZXR0aW5ncyl7XG4gICAgICAgIGVsZW1lbnQgPSBjb21wb25lbnQuZ2V0RXZlbnRFbGVtZW50KGtleSk7XG4gICAgICAgIGlmKGtleS5zbGljZSgwLDIpID09PSAnb24nICYmIGtleSBpbiBlbGVtZW50KXtcbiAgICAgICAgICAgIGFkZEF1dG9IYW5kbGVyKGNvbXBvbmVudCwgZWxlbWVudCwga2V5LCBjb21wb25lbnQuX3NldHRpbmdzKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIGZvcih2YXIgZXZlbnRLZXkgaW4gY29tcG9uZW50Ll9ldmVudHMpe1xuICAgICAgICBlbGVtZW50ID0gY29tcG9uZW50LmdldEV2ZW50RWxlbWVudChrZXkpO1xuICAgICAgICBhZGREb21IYW5kbGVycyhjb21wb25lbnQsIGVsZW1lbnQsIGV2ZW50S2V5KTtcbiAgICB9XG59XG5cbmZ1bmN0aW9uIHJlbmRlcigpe1xuICAgIHRoaXMuZWxlbWVudCA9IHRoaXMuY3JlYXRlRWxlbWVudCh0aGlzLl9zZXR0aW5ncy50YWdOYW1lIHx8IHRoaXMuX3RhZ05hbWUpO1xuXG4gICAgdGhpcy5lbWl0KCdyZW5kZXInKTtcblxuICAgIHJldHVybiB0aGlzO1xufTtcblxuZnVuY3Rpb24gZ2VuZXJpY0NvbXBvbmVudChmYXN0biwgY29tcG9uZW50LCB0eXBlLCBzZXR0aW5ncywgY2hpbGRyZW4pe1xuICAgIGlmKGNvbXBvbmVudC5pcyh0eXBlKSl7XG4gICAgICAgIHJldHVybiBjb21wb25lbnQ7XG4gICAgfVxuXG4gICAgaWYodHlwZSA9PT0gR0VORVJJQyl7XG4gICAgICAgIGNvbXBvbmVudC5fdGFnTmFtZSA9IGNvbXBvbmVudC5fdGFnTmFtZSB8fCAnZGl2JztcbiAgICB9ZWxzZXtcbiAgICAgICAgY29tcG9uZW50Ll90YWdOYW1lID0gdHlwZTtcbiAgICB9XG5cbiAgICBpZihjb21wb25lbnQuaXMoR0VORVJJQykpe1xuICAgICAgICByZXR1cm4gY29tcG9uZW50O1xuICAgIH1cblxuICAgIGNvbXBvbmVudC5leHRlbmQoJ19jb250YWluZXInLCBzZXR0aW5ncywgY2hpbGRyZW4pO1xuXG4gICAgY29tcG9uZW50LmFkZERvbVByb3BlcnR5ID0gYWRkRG9tUHJvcGVydHkuYmluZChjb21wb25lbnQsIGZhc3RuKTtcbiAgICBjb21wb25lbnQuZ2V0RXZlbnRFbGVtZW50ID0gY29tcG9uZW50LmdldENvbnRhaW5lckVsZW1lbnQ7XG4gICAgY29tcG9uZW50LmdldFByb3BlcnR5RWxlbWVudCA9IGNvbXBvbmVudC5nZXRDb250YWluZXJFbGVtZW50O1xuICAgIGNvbXBvbmVudC51cGRhdGVQcm9wZXJ0eSA9IGdlbmVyaWNDb21wb25lbnQudXBkYXRlUHJvcGVydHk7XG4gICAgY29tcG9uZW50LmNyZWF0ZUVsZW1lbnQgPSBnZW5lcmljQ29tcG9uZW50LmNyZWF0ZUVsZW1lbnQ7XG5cbiAgICBjcmVhdGVQcm9wZXJ0aWVzKGZhc3RuLCBjb21wb25lbnQsIHNldHRpbmdzKTtcblxuICAgIGNvbXBvbmVudC5yZW5kZXIgPSByZW5kZXIuYmluZChjb21wb25lbnQpO1xuXG4gICAgY29tcG9uZW50Lm9uKCdyZW5kZXInLCBvblJlbmRlcik7XG5cbiAgICByZXR1cm4gY29tcG9uZW50O1xufVxuXG5nZW5lcmljQ29tcG9uZW50LnVwZGF0ZVByb3BlcnR5ID0gZnVuY3Rpb24oY29tcG9uZW50LCBwcm9wZXJ0eSwgdXBkYXRlKXtcbiAgICBpZih0eXBlb2YgZG9jdW1lbnQgIT09ICd1bmRlZmluZWQnICYmIGRvY3VtZW50LmNvbnRhaW5zKGNvbXBvbmVudC5lbGVtZW50KSl7XG4gICAgICAgIHNjaGVkdWxlKHByb3BlcnR5LCB1cGRhdGUpO1xuICAgIH1lbHNle1xuICAgICAgICB1cGRhdGUoKTtcbiAgICB9XG59O1xuXG5nZW5lcmljQ29tcG9uZW50LmNyZWF0ZUVsZW1lbnQgPSBmdW5jdGlvbih0YWdOYW1lKXtcbiAgICBpZih0YWdOYW1lIGluc3RhbmNlb2YgTm9kZSl7XG4gICAgICAgIHJldHVybiB0YWdOYW1lO1xuICAgIH1cbiAgICByZXR1cm4gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCh0YWdOYW1lKTtcbn07XG5cbm1vZHVsZS5leHBvcnRzID0gZ2VuZXJpY0NvbXBvbmVudDsiLCJ2YXIgY3JlYXRlUHJvcGVydHkgPSByZXF1aXJlKCcuL3Byb3BlcnR5JyksXG4gICAgY3JlYXRlQmluZGluZyA9IHJlcXVpcmUoJy4vYmluZGluZycpLFxuICAgIEJhc2VDb21wb25lbnQgPSByZXF1aXJlKCcuL2Jhc2VDb21wb25lbnQnKSxcbiAgICBjcmVsID0gcmVxdWlyZSgnY3JlbCcpLFxuICAgIEVudGkgPSByZXF1aXJlKCdlbnRpJyksXG4gICAgb2JqZWN0QXNzaWduID0gcmVxdWlyZSgnb2JqZWN0LWFzc2lnbicpLFxuICAgIGlzID0gcmVxdWlyZSgnLi9pcycpO1xuXG5mdW5jdGlvbiBpbmZsYXRlUHJvcGVydGllcyhjb21wb25lbnQsIHNldHRpbmdzKXtcbiAgICBmb3IodmFyIGtleSBpbiBzZXR0aW5ncyl7XG4gICAgICAgIHZhciBzZXR0aW5nID0gc2V0dGluZ3Nba2V5XSxcbiAgICAgICAgICAgIHByb3BlcnR5ID0gY29tcG9uZW50W2tleV07XG5cbiAgICAgICAgaWYoaXMucHJvcGVydHkoc2V0dGluZ3Nba2V5XSkpe1xuXG4gICAgICAgICAgICBpZihpcy5wcm9wZXJ0eShwcm9wZXJ0eSkpe1xuICAgICAgICAgICAgICAgIHByb3BlcnR5LmRlc3Ryb3koKTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgc2V0dGluZy5hZGRUbyhjb21wb25lbnQsIGtleSk7XG5cbiAgICAgICAgfWVsc2UgaWYoaXMucHJvcGVydHkocHJvcGVydHkpKXtcblxuICAgICAgICAgICAgaWYoaXMuYmluZGluZyhzZXR0aW5nKSl7XG4gICAgICAgICAgICAgICAgcHJvcGVydHkuYmluZGluZyhzZXR0aW5nKTtcbiAgICAgICAgICAgIH1lbHNle1xuICAgICAgICAgICAgICAgIHByb3BlcnR5KHNldHRpbmcpO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBwcm9wZXJ0eS5hZGRUbyhjb21wb25lbnQsIGtleSk7XG4gICAgICAgIH1cbiAgICB9XG59XG5cbmZ1bmN0aW9uIHZhbGlkYXRlRXhwZWN0ZWRDb21wb25lbnRzKGNvbXBvbmVudHMsIGNvbXBvbmVudE5hbWUsIGV4cGVjdGVkQ29tcG9uZW50cyl7XG4gICAgZXhwZWN0ZWRDb21wb25lbnRzID0gZXhwZWN0ZWRDb21wb25lbnRzLmZpbHRlcihmdW5jdGlvbihjb21wb25lbnROYW1lKXtcbiAgICAgICAgcmV0dXJuICEoY29tcG9uZW50TmFtZSBpbiBjb21wb25lbnRzKTtcbiAgICB9KTtcblxuICAgIGlmKGV4cGVjdGVkQ29tcG9uZW50cy5sZW5ndGgpe1xuICAgICAgICBjb25zb2xlLndhcm4oW1xuICAgICAgICAgICAgJ2Zhc3RuKFwiJyArIGNvbXBvbmVudE5hbWUgKyAnXCIpIHVzZXMgc29tZSBjb21wb25lbnRzIHRoYXQgaGF2ZSBub3QgYmVlbiByZWdpc3RlcmVkIHdpdGggZmFzdG4nLFxuICAgICAgICAgICAgJ0V4cGVjdGVkIGNvbnBvbmVudCBjb25zdHJ1Y3RvcnM6ICcgKyBleHBlY3RlZENvbXBvbmVudHMuam9pbignLCAnKVxuICAgICAgICBdLmpvaW4oJ1xcblxcbicpKTtcbiAgICB9XG59XG5cbm1vZHVsZS5leHBvcnRzID0gZnVuY3Rpb24oY29tcG9uZW50cywgZGVidWcpe1xuXG4gICAgaWYoIWNvbXBvbmVudHMgfHwgdHlwZW9mIGNvbXBvbmVudHMgIT09ICdvYmplY3QnKXtcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKCdmYXN0biBtdXN0IGJlIGluaXRpYWxpc2VkIHdpdGggYSBjb21wb25lbnRzIG9iamVjdCcpO1xuICAgIH1cblxuICAgIGNvbXBvbmVudHMuX2NvbnRhaW5lciA9IGNvbXBvbmVudHMuX2NvbnRhaW5lciB8fCByZXF1aXJlKCcuL2NvbnRhaW5lckNvbXBvbmVudCcpO1xuXG4gICAgZnVuY3Rpb24gZmFzdG4odHlwZSl7XG5cbiAgICAgICAgdmFyIGFyZ3MgPSBbXTtcbiAgICAgICAgZm9yKHZhciBpID0gMDsgaSA8IGFyZ3VtZW50cy5sZW5ndGg7IGkrKyl7XG4gICAgICAgICAgICBhcmdzW2ldID0gYXJndW1lbnRzW2ldO1xuICAgICAgICB9XG5cbiAgICAgICAgdmFyIHNldHRpbmdzID0gYXJnc1sxXSxcbiAgICAgICAgICAgIGNoaWxkcmVuSW5kZXggPSAyLFxuICAgICAgICAgICAgc2V0dGluZ3NDaGlsZCA9IGZhc3RuLnRvQ29tcG9uZW50KGFyZ3NbMV0pO1xuXG4gICAgICAgIGlmKEFycmF5LmlzQXJyYXkoYXJnc1sxXSkgfHwgc2V0dGluZ3NDaGlsZCB8fCAhYXJnc1sxXSl7XG4gICAgICAgICAgICBhcmdzWzFdID0gc2V0dGluZ3NDaGlsZCB8fCBhcmdzWzFdO1xuICAgICAgICAgICAgY2hpbGRyZW5JbmRleC0tO1xuICAgICAgICAgICAgc2V0dGluZ3MgPSBudWxsO1xuICAgICAgICB9XG5cbiAgICAgICAgc2V0dGluZ3MgPSBvYmplY3RBc3NpZ24oe30sIHNldHRpbmdzIHx8IHt9KTtcblxuICAgICAgICB2YXIgdHlwZXMgPSB0eXBlb2YgdHlwZSA9PT0gJ3N0cmluZycgPyB0eXBlLnNwbGl0KCc6JykgOiBBcnJheS5pc0FycmF5KHR5cGUpID8gdHlwZSA6IFt0eXBlXSxcbiAgICAgICAgICAgIGJhc2VUeXBlLFxuICAgICAgICAgICAgY2hpbGRyZW4gPSBhcmdzLnNsaWNlKGNoaWxkcmVuSW5kZXgpLFxuICAgICAgICAgICAgY29tcG9uZW50ID0gZmFzdG4uYmFzZSh0eXBlLCBzZXR0aW5ncywgY2hpbGRyZW4pO1xuXG4gICAgICAgIHdoaWxlKGJhc2VUeXBlID0gdHlwZXMuc2hpZnQoKSl7XG4gICAgICAgICAgICBjb21wb25lbnQuZXh0ZW5kKGJhc2VUeXBlLCBzZXR0aW5ncywgY2hpbGRyZW4pO1xuICAgICAgICB9XG5cbiAgICAgICAgY29tcG9uZW50Ll9wcm9wZXJ0aWVzID0ge307XG5cbiAgICAgICAgaW5mbGF0ZVByb3BlcnRpZXMoY29tcG9uZW50LCBzZXR0aW5ncyk7XG5cbiAgICAgICAgcmV0dXJuIGNvbXBvbmVudDtcbiAgICB9XG5cbiAgICBmYXN0bi50b0NvbXBvbmVudCA9IGZ1bmN0aW9uKGNvbXBvbmVudCl7XG4gICAgICAgIGlmKGNvbXBvbmVudCA9PSBudWxsKXtcbiAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuICAgICAgICBpZihpcy5jb21wb25lbnQoY29tcG9uZW50KSl7XG4gICAgICAgICAgICByZXR1cm4gY29tcG9uZW50O1xuICAgICAgICB9XG4gICAgICAgIGlmKHR5cGVvZiBjb21wb25lbnQgIT09ICdvYmplY3QnIHx8IGNvbXBvbmVudCBpbnN0YW5jZW9mIERhdGUpe1xuICAgICAgICAgICAgcmV0dXJuIGZhc3RuKCd0ZXh0Jywge2F1dG86IHRydWV9LCBjb21wb25lbnQpO1xuICAgICAgICB9XG4gICAgICAgIGlmKGNyZWwuaXNFbGVtZW50KGNvbXBvbmVudCkpe1xuICAgICAgICAgICAgcmV0dXJuIGZhc3RuKGNvbXBvbmVudCk7XG4gICAgICAgIH1cbiAgICAgICAgaWYoY3JlbC5pc05vZGUoY29tcG9uZW50KSl7XG4gICAgICAgICAgICByZXR1cm4gZmFzdG4oJ3RleHQnLCB7YXV0bzogdHJ1ZX0sIGNvbXBvbmVudC50ZXh0Q29udGVudCk7XG4gICAgICAgIH1cbiAgICB9O1xuXG4gICAgZmFzdG4uZGVidWcgPSBkZWJ1ZztcbiAgICBmYXN0bi5wcm9wZXJ0eSA9IGNyZWF0ZVByb3BlcnR5O1xuICAgIGZhc3RuLmJpbmRpbmcgPSBjcmVhdGVCaW5kaW5nO1xuICAgIGZhc3RuLmlzQ29tcG9uZW50ID0gaXMuY29tcG9uZW50O1xuICAgIGZhc3RuLmlzQmluZGluZyA9IGlzLmJpbmRpbmc7XG4gICAgZmFzdG4uaXNEZWZhdWx0QmluZGluZyA9IGlzLmRlZmF1bHRCaW5kaW5nO1xuICAgIGZhc3RuLmlzQmluZGluZ09iamVjdCA9IGlzLmJpbmRpbmdPYmplY3Q7XG4gICAgZmFzdG4uaXNQcm9wZXJ0eSA9IGlzLnByb3BlcnR5O1xuICAgIGZhc3RuLmNvbXBvbmVudHMgPSBjb21wb25lbnRzO1xuICAgIGZhc3RuLk1vZGVsID0gRW50aTtcblxuICAgIGZhc3RuLmJhc2UgPSBmdW5jdGlvbih0eXBlLCBzZXR0aW5ncywgY2hpbGRyZW4pe1xuICAgICAgICByZXR1cm4gbmV3IEJhc2VDb21wb25lbnQoZmFzdG4sIHR5cGUsIHNldHRpbmdzLCBjaGlsZHJlbik7XG4gICAgfTtcblxuICAgIGZvcih2YXIga2V5IGluIGNvbXBvbmVudHMpe1xuICAgICAgICB2YXIgY29tcG9uZW50Q29uc3RydWN0b3IgPSBjb21wb25lbnRzW2tleV07XG5cbiAgICAgICAgaWYoY29tcG9uZW50Q29uc3RydWN0b3IuZXhwZWN0ZWRDb21wb25lbnRzKXtcbiAgICAgICAgICAgIHZhbGlkYXRlRXhwZWN0ZWRDb21wb25lbnRzKGNvbXBvbmVudHMsIGtleSwgY29tcG9uZW50Q29uc3RydWN0b3IuZXhwZWN0ZWRDb21wb25lbnRzKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIHJldHVybiBmYXN0bjtcbn07IiwidmFyIEZVTkNUSU9OID0gJ2Z1bmN0aW9uJyxcbiAgICBPQkpFQ1QgPSAnb2JqZWN0JyxcbiAgICBGQVNUTkJJTkRJTkcgPSAnX2Zhc3RuX2JpbmRpbmcnLFxuICAgIEZBU1ROUFJPUEVSVFkgPSAnX2Zhc3RuX3Byb3BlcnR5JyxcbiAgICBGQVNUTkNPTVBPTkVOVCA9ICdfZmFzdG5fY29tcG9uZW50JyxcbiAgICBERUZBVUxUQklORElORyA9ICdfZGVmYXVsdF9iaW5kaW5nJztcblxuZnVuY3Rpb24gaXNDb21wb25lbnQodGhpbmcpe1xuICAgIHJldHVybiB0aGluZyAmJiB0eXBlb2YgdGhpbmcgPT09IE9CSkVDVCAmJiBGQVNUTkNPTVBPTkVOVCBpbiB0aGluZztcbn1cblxuZnVuY3Rpb24gaXNCaW5kaW5nT2JqZWN0KHRoaW5nKXtcbiAgICByZXR1cm4gdGhpbmcgJiYgdHlwZW9mIHRoaW5nID09PSBPQkpFQ1QgJiYgRkFTVE5CSU5ESU5HIGluIHRoaW5nO1xufVxuXG5mdW5jdGlvbiBpc0JpbmRpbmcodGhpbmcpe1xuICAgIHJldHVybiB0eXBlb2YgdGhpbmcgPT09IEZVTkNUSU9OICYmIEZBU1ROQklORElORyBpbiB0aGluZztcbn1cblxuZnVuY3Rpb24gaXNQcm9wZXJ0eSh0aGluZyl7XG4gICAgcmV0dXJuIHR5cGVvZiB0aGluZyA9PT0gRlVOQ1RJT04gJiYgRkFTVE5QUk9QRVJUWSBpbiB0aGluZztcbn1cblxuZnVuY3Rpb24gaXNEZWZhdWx0QmluZGluZyh0aGluZyl7XG4gICAgcmV0dXJuIHR5cGVvZiB0aGluZyA9PT0gRlVOQ1RJT04gJiYgRkFTVE5CSU5ESU5HIGluIHRoaW5nICYmIERFRkFVTFRCSU5ESU5HIGluIHRoaW5nO1xufVxuXG5tb2R1bGUuZXhwb3J0cyA9IHtcbiAgICBjb21wb25lbnQ6IGlzQ29tcG9uZW50LFxuICAgIGJpbmRpbmdPYmplY3Q6IGlzQmluZGluZ09iamVjdCxcbiAgICBiaW5kaW5nOiBpc0JpbmRpbmcsXG4gICAgZGVmYXVsdEJpbmRpbmc6IGlzRGVmYXVsdEJpbmRpbmcsXG4gICAgcHJvcGVydHk6IGlzUHJvcGVydHlcbn07IiwibW9kdWxlLmV4cG9ydHMgPSBmdW5jdGlvbihlbGVtZW50KXtcbiAgICB2YXIgbGFzdENsYXNzZXMgPSBbXTtcblxuICAgIHJldHVybiBmdW5jdGlvbihjbGFzc2VzKXtcblxuICAgICAgICBpZighYXJndW1lbnRzLmxlbmd0aCl7XG4gICAgICAgICAgICByZXR1cm4gbGFzdENsYXNzZXMuam9pbignICcpO1xuICAgICAgICB9XG5cbiAgICAgICAgZnVuY3Rpb24gY2xlYW5DbGFzc05hbWUocmVzdWx0LCBjbGFzc05hbWUpe1xuICAgICAgICAgICAgaWYodHlwZW9mIGNsYXNzTmFtZSA9PT0gJ3N0cmluZycgJiYgY2xhc3NOYW1lLm1hdGNoKC9cXHMvKSl7XG4gICAgICAgICAgICAgICAgY2xhc3NOYW1lID0gY2xhc3NOYW1lLnNwbGl0KCcgJyk7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGlmKEFycmF5LmlzQXJyYXkoY2xhc3NOYW1lKSl7XG4gICAgICAgICAgICAgICAgcmV0dXJuIHJlc3VsdC5jb25jYXQoY2xhc3NOYW1lLnJlZHVjZShjbGVhbkNsYXNzTmFtZSwgW10pKTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgaWYoY2xhc3NOYW1lICE9IG51bGwgJiYgY2xhc3NOYW1lICE9PSAnJyAmJiB0eXBlb2YgY2xhc3NOYW1lICE9PSAnYm9vbGVhbicpe1xuICAgICAgICAgICAgICAgIHJlc3VsdC5wdXNoKFN0cmluZyhjbGFzc05hbWUpLnRyaW0oKSk7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIHJldHVybiByZXN1bHQ7XG4gICAgICAgIH1cblxuICAgICAgICB2YXIgbmV3Q2xhc3NlcyA9IGNsZWFuQ2xhc3NOYW1lKFtdLCBjbGFzc2VzKSxcbiAgICAgICAgICAgIGN1cnJlbnRDbGFzc2VzID0gZWxlbWVudC5jbGFzc05hbWUgPyBlbGVtZW50LmNsYXNzTmFtZS5zcGxpdCgnICcpIDogW107XG5cbiAgICAgICAgbGFzdENsYXNzZXMubWFwKGZ1bmN0aW9uKGNsYXNzTmFtZSl7XG4gICAgICAgICAgICBpZighY2xhc3NOYW1lKXtcbiAgICAgICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIHZhciBpbmRleCA9IGN1cnJlbnRDbGFzc2VzLmluZGV4T2YoY2xhc3NOYW1lKTtcblxuICAgICAgICAgICAgaWYofmluZGV4KXtcbiAgICAgICAgICAgICAgICBjdXJyZW50Q2xhc3Nlcy5zcGxpY2UoaW5kZXgsIDEpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9KTtcblxuICAgICAgICBjdXJyZW50Q2xhc3NlcyA9IGN1cnJlbnRDbGFzc2VzLmNvbmNhdChuZXdDbGFzc2VzKTtcbiAgICAgICAgbGFzdENsYXNzZXMgPSBuZXdDbGFzc2VzO1xuXG4gICAgICAgIGVsZW1lbnQuY2xhc3NOYW1lID0gY3VycmVudENsYXNzZXMuam9pbignICcpO1xuICAgIH07XG59O1xuIiwidmFyIEV2ZW50RW1pdHRlciA9IHJlcXVpcmUoJ2V2ZW50cycpLkV2ZW50RW1pdHRlcjtcblxuZnVuY3Rpb24gdG9BcnJheShpdGVtcyl7XG4gICAgcmV0dXJuIEFycmF5LnByb3RvdHlwZS5zbGljZS5jYWxsKGl0ZW1zKTtcbn1cblxudmFyIGRlZXBSZWdleCA9IC9bfC5dL2k7XG5cbmZ1bmN0aW9uIG1hdGNoRGVlcChwYXRoKXtcbiAgICByZXR1cm4gKHBhdGggKyAnJykubWF0Y2goZGVlcFJlZ2V4KTtcbn1cblxuZnVuY3Rpb24gaXNXaWxkY2FyZFBhdGgocGF0aCl7XG4gICAgdmFyIHN0cmluZ1BhdGggPSAocGF0aCArICcnKTtcbiAgICByZXR1cm4gfnN0cmluZ1BhdGguaW5kZXhPZignKicpO1xufVxuXG5mdW5jdGlvbiBnZXRUYXJnZXRLZXkocGF0aCl7XG4gICAgdmFyIHN0cmluZ1BhdGggPSAocGF0aCArICcnKTtcbiAgICByZXR1cm4gc3RyaW5nUGF0aC5zcGxpdCgnfCcpLnNoaWZ0KCk7XG59XG5cbnZhciBldmVudFN5c3RlbVZlcnNpb24gPSAxLFxuICAgIGdsb2JhbEtleSA9ICdfZW50aUV2ZW50U3RhdGUnICsgZXZlbnRTeXN0ZW1WZXJzaW9uXG4gICAgZ2xvYmFsU3RhdGUgPSBnbG9iYWxbZ2xvYmFsS2V5XSA9IGdsb2JhbFtnbG9iYWxLZXldIHx8IHtcbiAgICAgICAgaW5zdGFuY2VzOiBbXVxuICAgIH07XG5cbnZhciBtb2RpZmllZEVudGllcyA9IGdsb2JhbFN0YXRlLm1vZGlmaWVkRW50aWVzID0gZ2xvYmFsU3RhdGUubW9kaWZpZWRFbnRpZXMgfHwgbmV3IFNldCgpLFxuICAgIHRyYWNrZWRPYmplY3RzID0gZ2xvYmFsU3RhdGUudHJhY2tlZE9iamVjdHMgPSBnbG9iYWxTdGF0ZS50cmFja2VkT2JqZWN0cyB8fCBuZXcgV2Vha01hcCgpO1xuXG5mdW5jdGlvbiBsZWZ0QW5kUmVzdChwYXRoKXtcbiAgICB2YXIgc3RyaW5nUGF0aCA9IChwYXRoICsgJycpO1xuXG4gICAgLy8gU3BlY2lhbCBjYXNlIHdoZW4geW91IHdhbnQgdG8gZmlsdGVyIG9uIHNlbGYgKC4pXG4gICAgaWYoc3RyaW5nUGF0aC5zbGljZSgwLDIpID09PSAnLnwnKXtcbiAgICAgICAgcmV0dXJuIFsnLicsIHN0cmluZ1BhdGguc2xpY2UoMildO1xuICAgIH1cblxuICAgIHZhciBtYXRjaCA9IG1hdGNoRGVlcChzdHJpbmdQYXRoKTtcbiAgICBpZihtYXRjaCl7XG4gICAgICAgIHJldHVybiBbc3RyaW5nUGF0aC5zbGljZSgwLCBtYXRjaC5pbmRleCksIHN0cmluZ1BhdGguc2xpY2UobWF0Y2guaW5kZXgrMSldO1xuICAgIH1cbiAgICByZXR1cm4gc3RyaW5nUGF0aDtcbn1cblxuZnVuY3Rpb24gaXNXaWxkY2FyZEtleShrZXkpe1xuICAgIHJldHVybiBrZXkuY2hhckF0KDApID09PSAnKic7XG59XG5cbmZ1bmN0aW9uIGlzRmVyYWxjYXJkS2V5KGtleSl7XG4gICAgcmV0dXJuIGtleSA9PT0gJyoqJztcbn1cblxuZnVuY3Rpb24gYWRkSGFuZGxlcihvYmplY3QsIGtleSwgaGFuZGxlcil7XG4gICAgdmFyIHRyYWNrZWRLZXlzID0gdHJhY2tlZE9iamVjdHMuZ2V0KG9iamVjdCk7XG5cbiAgICBpZih0cmFja2VkS2V5cyA9PSBudWxsKXtcbiAgICAgICAgdHJhY2tlZEtleXMgPSB7fTtcbiAgICAgICAgdHJhY2tlZE9iamVjdHMuc2V0KG9iamVjdCwgdHJhY2tlZEtleXMpO1xuICAgIH1cblxuICAgIHZhciBoYW5kbGVycyA9IHRyYWNrZWRLZXlzW2tleV07XG5cbiAgICBpZighaGFuZGxlcnMpe1xuICAgICAgICBoYW5kbGVycyA9IG5ldyBTZXQoKTtcbiAgICAgICAgdHJhY2tlZEtleXNba2V5XSA9IGhhbmRsZXJzO1xuICAgIH1cblxuICAgIGhhbmRsZXJzLmFkZChoYW5kbGVyKTtcbn1cblxuZnVuY3Rpb24gcmVtb3ZlSGFuZGxlcihvYmplY3QsIGtleSwgaGFuZGxlcil7XG4gICAgdmFyIHRyYWNrZWRLZXlzID0gdHJhY2tlZE9iamVjdHMuZ2V0KG9iamVjdCk7XG5cbiAgICBpZih0cmFja2VkS2V5cyA9PSBudWxsKXtcbiAgICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIHZhciBoYW5kbGVycyA9IHRyYWNrZWRLZXlzW2tleV07XG5cbiAgICBpZighaGFuZGxlcnMpe1xuICAgICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgaGFuZGxlcnMuZGVsZXRlKGhhbmRsZXIpO1xufVxuXG5mdW5jdGlvbiB0cmFja09iamVjdHMoZXZlbnROYW1lLCB0cmFja2VkLCBoYW5kbGVyLCBvYmplY3QsIGtleSwgcGF0aCl7XG4gICAgaWYoIW9iamVjdCB8fCB0eXBlb2Ygb2JqZWN0ICE9PSAnb2JqZWN0Jyl7XG4gICAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICB2YXIgZXZlbnRLZXkgPSBrZXkgPT09ICcqKicgPyAnKicgOiBrZXksXG4gICAgICAgIHRhcmdldCA9IG9iamVjdFtrZXldLFxuICAgICAgICB0YXJnZXRJc09iamVjdCA9IHRhcmdldCAmJiB0eXBlb2YgdGFyZ2V0ID09PSAnb2JqZWN0JztcblxuICAgIGlmKHRhcmdldElzT2JqZWN0ICYmIHRyYWNrZWQuaGFzKHRhcmdldCkpe1xuICAgICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgdmFyIGhhbmRsZSA9IGZ1bmN0aW9uKHZhbHVlLCBldmVudCwgZW1pdEtleSl7XG4gICAgICAgIGlmKGV2ZW50S2V5ICE9PSAnKicgJiYgdHlwZW9mIG9iamVjdFtldmVudEtleV0gPT09ICdvYmplY3QnICYmIG9iamVjdFtldmVudEtleV0gIT09IHRhcmdldCl7XG4gICAgICAgICAgICBpZih0YXJnZXRJc09iamVjdCl7XG4gICAgICAgICAgICAgICAgdHJhY2tlZC5kZWxldGUodGFyZ2V0KTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHJlbW92ZUhhbmRsZXIob2JqZWN0LCBldmVudEtleSwgaGFuZGxlKTtcbiAgICAgICAgICAgIHRyYWNrT2JqZWN0cyhldmVudE5hbWUsIHRyYWNrZWQsIGhhbmRsZXIsIG9iamVjdCwga2V5LCBwYXRoKTtcbiAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmKGV2ZW50S2V5ID09PSAnKicpe1xuICAgICAgICAgICAgdHJhY2tLZXlzKG9iamVjdCwga2V5LCBwYXRoKTtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmKCF0cmFja2VkLmhhcyhvYmplY3QpKXtcbiAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmKGtleSAhPT0gJyoqJyB8fCAhcGF0aCl7XG4gICAgICAgICAgICBoYW5kbGVyKHZhbHVlLCBldmVudCwgZW1pdEtleSk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBmdW5jdGlvbiB0cmFja0tleXModGFyZ2V0LCByb290LCByZXN0KXtcbiAgICAgICAgdmFyIGtleXMgPSBPYmplY3Qua2V5cyh0YXJnZXQpO1xuICAgICAgICBmb3IodmFyIGkgPSAwOyBpIDwga2V5cy5sZW5ndGg7IGkrKyl7XG4gICAgICAgICAgICBpZihpc0ZlcmFsY2FyZEtleShyb290KSl7XG4gICAgICAgICAgICAgICAgdHJhY2tPYmplY3RzKGV2ZW50TmFtZSwgdHJhY2tlZCwgaGFuZGxlciwgdGFyZ2V0LCBrZXlzW2ldLCAnKionICsgKHJlc3QgPyAnLicgOiAnJykgKyAocmVzdCB8fCAnJykpO1xuICAgICAgICAgICAgfWVsc2V7XG4gICAgICAgICAgICAgICAgdHJhY2tPYmplY3RzKGV2ZW50TmFtZSwgdHJhY2tlZCwgaGFuZGxlciwgdGFyZ2V0LCBrZXlzW2ldLCByZXN0KTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH1cblxuICAgIGFkZEhhbmRsZXIob2JqZWN0LCBldmVudEtleSwgaGFuZGxlKTtcblxuICAgIGlmKCF0YXJnZXRJc09iamVjdCl7XG4gICAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICAvLyBUaGlzIHdvdWxkIG9idmlvdXNseSBiZSBiZXR0ZXIgaW1wbGVtZW50ZWQgd2l0aCBhIFdlYWtTZXQsXG4gICAgLy8gQnV0IEknbSB0cnlpbmcgdG8ga2VlcCBmaWxlc2l6ZSBkb3duLCBhbmQgSSBkb24ndCByZWFsbHkgd2FudCBhbm90aGVyXG4gICAgLy8gcG9seWZpbGwgd2hlbiBXZWFrTWFwIHdvcmtzIHdlbGwgZW5vdWdoIGZvciB0aGUgdGFzay5cbiAgICB0cmFja2VkLmFkZCh0YXJnZXQpO1xuXG4gICAgaWYoIXBhdGgpe1xuICAgICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgdmFyIHJvb3RBbmRSZXN0ID0gbGVmdEFuZFJlc3QocGF0aCksXG4gICAgICAgIHJvb3QsXG4gICAgICAgIHJlc3Q7XG5cbiAgICBpZighQXJyYXkuaXNBcnJheShyb290QW5kUmVzdCkpe1xuICAgICAgICByb290ID0gcm9vdEFuZFJlc3Q7XG4gICAgfWVsc2V7XG4gICAgICAgIHJvb3QgPSByb290QW5kUmVzdFswXTtcbiAgICAgICAgcmVzdCA9IHJvb3RBbmRSZXN0WzFdO1xuXG4gICAgICAgIC8vIElmIHRoZSByb290IGlzICcuJywgd2F0Y2ggZm9yIGV2ZW50cyBvbiAqXG4gICAgICAgIGlmKHJvb3QgPT09ICcuJyl7XG4gICAgICAgICAgICByb290ID0gJyonO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgaWYodGFyZ2V0SXNPYmplY3QgJiYgaXNXaWxkY2FyZEtleShyb290KSl7XG4gICAgICAgIHRyYWNrS2V5cyh0YXJnZXQsIHJvb3QsIHJlc3QpO1xuICAgIH1cblxuICAgIHRyYWNrT2JqZWN0cyhldmVudE5hbWUsIHRyYWNrZWQsIGhhbmRsZXIsIHRhcmdldCwgcm9vdCwgcmVzdCk7XG59XG5cbnZhciB0cmFja2VkRXZlbnRzID0gbmV3IFdlYWtNYXAoKTtcbmZ1bmN0aW9uIGNyZWF0ZUhhbmRsZXIoZW50aSwgdHJhY2tlZE9iamVjdFBhdGhzLCB0cmFja2VkUGF0aHMsIGV2ZW50TmFtZSl7XG4gICAgdmFyIG9sZE1vZGVsID0gZW50aS5fbW9kZWw7XG4gICAgcmV0dXJuIGZ1bmN0aW9uKGV2ZW50LCBlbWl0S2V5KXtcbiAgICAgICAgdHJhY2tlZFBhdGhzLmVudGlzLmZvckVhY2goZnVuY3Rpb24oZW50aSl7XG4gICAgICAgICAgICBpZihlbnRpLl9lbWl0dGVkRXZlbnRzW2V2ZW50TmFtZV0gPT09IGVtaXRLZXkpe1xuICAgICAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgaWYoZW50aS5fbW9kZWwgIT09IG9sZE1vZGVsKXtcbiAgICAgICAgICAgICAgICB0cmFja2VkUGF0aHMuZW50aXMuZGVsZXRlKGVudGkpO1xuICAgICAgICAgICAgICAgIGlmKHRyYWNrZWRQYXRocy5lbnRpcy5zaXplID09PSAwKXtcbiAgICAgICAgICAgICAgICAgICAgZGVsZXRlIHRyYWNrZWRPYmplY3RQYXRoc1tldmVudE5hbWVdO1xuICAgICAgICAgICAgICAgICAgICBpZighT2JqZWN0LmtleXModHJhY2tlZE9iamVjdFBhdGhzKS5sZW5ndGgpe1xuICAgICAgICAgICAgICAgICAgICAgICAgdHJhY2tlZEV2ZW50cy5kZWxldGUob2xkTW9kZWwpO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgZW50aS5fZW1pdHRlZEV2ZW50c1tldmVudE5hbWVdID0gZW1pdEtleTtcblxuICAgICAgICAgICAgdmFyIHRhcmdldEtleSA9IGdldFRhcmdldEtleShldmVudE5hbWUpLFxuICAgICAgICAgICAgICAgIHZhbHVlID0gaXNXaWxkY2FyZFBhdGgodGFyZ2V0S2V5KSA/IHVuZGVmaW5lZCA6IGVudGkuZ2V0KHRhcmdldEtleSk7XG5cbiAgICAgICAgICAgIGVudGkuZW1pdChldmVudE5hbWUsIHZhbHVlLCBldmVudCk7XG4gICAgICAgIH0pO1xuICAgIH07XG59XG5cbmZ1bmN0aW9uIHRyYWNrUGF0aChlbnRpLCBldmVudE5hbWUpe1xuICAgIHZhciBvYmplY3QgPSBlbnRpLl9tb2RlbCxcbiAgICAgICAgdHJhY2tlZE9iamVjdFBhdGhzID0gdHJhY2tlZEV2ZW50cy5nZXQob2JqZWN0KTtcblxuICAgIGlmKCF0cmFja2VkT2JqZWN0UGF0aHMpe1xuICAgICAgICB0cmFja2VkT2JqZWN0UGF0aHMgPSB7fTtcbiAgICAgICAgdHJhY2tlZEV2ZW50cy5zZXQob2JqZWN0LCB0cmFja2VkT2JqZWN0UGF0aHMpO1xuICAgIH1cblxuICAgIHZhciB0cmFja2VkUGF0aHMgPSB0cmFja2VkT2JqZWN0UGF0aHNbZXZlbnROYW1lXTtcblxuICAgIGlmKCF0cmFja2VkUGF0aHMpe1xuICAgICAgICB0cmFja2VkUGF0aHMgPSB7XG4gICAgICAgICAgICBlbnRpczogbmV3IFNldCgpLFxuICAgICAgICAgICAgdHJhY2tlZE9iamVjdHM6IG5ldyBXZWFrU2V0KClcbiAgICAgICAgfTtcbiAgICAgICAgdHJhY2tlZE9iamVjdFBhdGhzW2V2ZW50TmFtZV0gPSB0cmFja2VkUGF0aHM7XG4gICAgfWVsc2UgaWYodHJhY2tlZFBhdGhzLmVudGlzLmhhcyhlbnRpKSl7XG4gICAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICB0cmFja2VkUGF0aHMuZW50aXMuYWRkKGVudGkpO1xuXG4gICAgdmFyIGhhbmRsZXIgPSBjcmVhdGVIYW5kbGVyKGVudGksIHRyYWNrZWRPYmplY3RQYXRocywgdHJhY2tlZFBhdGhzLCBldmVudE5hbWUpO1xuXG4gICAgdHJhY2tPYmplY3RzKGV2ZW50TmFtZSwgdHJhY2tlZFBhdGhzLnRyYWNrZWRPYmplY3RzLCBoYW5kbGVyLCB7bW9kZWw6b2JqZWN0fSwgJ21vZGVsJywgZXZlbnROYW1lKTtcbn1cblxuZnVuY3Rpb24gdHJhY2tQYXRocyhlbnRpKXtcbiAgICBpZighZW50aS5fZXZlbnRzIHx8ICFlbnRpLl9tb2RlbCl7XG4gICAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICBmb3IodmFyIGtleSBpbiBlbnRpLl9ldmVudHMpe1xuICAgICAgICB0cmFja1BhdGgoZW50aSwga2V5KTtcbiAgICB9XG4gICAgbW9kaWZpZWRFbnRpZXMuZGVsZXRlKGVudGkpO1xufVxuXG5mdW5jdGlvbiBlbWl0RXZlbnQob2JqZWN0LCBrZXksIHZhbHVlLCBlbWl0S2V5KXtcblxuICAgIG1vZGlmaWVkRW50aWVzLmZvckVhY2godHJhY2tQYXRocyk7XG5cbiAgICB2YXIgdHJhY2tlZEtleXMgPSB0cmFja2VkT2JqZWN0cy5nZXQob2JqZWN0KTtcblxuICAgIGlmKCF0cmFja2VkS2V5cyl7XG4gICAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICB2YXIgZXZlbnQgPSB7XG4gICAgICAgIHZhbHVlOiB2YWx1ZSxcbiAgICAgICAga2V5OiBrZXksXG4gICAgICAgIG9iamVjdDogb2JqZWN0XG4gICAgfTtcblxuICAgIGZ1bmN0aW9uIGVtaXRGb3JLZXkoaGFuZGxlcil7XG4gICAgICAgIGhhbmRsZXIoZXZlbnQsIGVtaXRLZXkpO1xuICAgIH1cblxuICAgIGlmKHRyYWNrZWRLZXlzW2tleV0pe1xuICAgICAgICB0cmFja2VkS2V5c1trZXldLmZvckVhY2goZW1pdEZvcktleSk7XG4gICAgfVxuXG4gICAgaWYodHJhY2tlZEtleXNbJyonXSl7XG4gICAgICAgIHRyYWNrZWRLZXlzWycqJ10uZm9yRWFjaChlbWl0Rm9yS2V5KTtcbiAgICB9XG59XG5cbmZ1bmN0aW9uIGVtaXQoZXZlbnRzKXtcbiAgICB2YXIgZW1pdEtleSA9IHt9O1xuICAgIGV2ZW50cy5mb3JFYWNoKGZ1bmN0aW9uKGV2ZW50KXtcbiAgICAgICAgZW1pdEV2ZW50KGV2ZW50WzBdLCBldmVudFsxXSwgZXZlbnRbMl0sIGVtaXRLZXkpO1xuICAgIH0pO1xufVxuXG5mdW5jdGlvbiBFbnRpKG1vZGVsKXtcbiAgICB2YXIgZGV0YWNoZWQgPSBtb2RlbCA9PT0gZmFsc2U7XG5cbiAgICBpZighbW9kZWwgfHwgKHR5cGVvZiBtb2RlbCAhPT0gJ29iamVjdCcgJiYgdHlwZW9mIG1vZGVsICE9PSAnZnVuY3Rpb24nKSl7XG4gICAgICAgIG1vZGVsID0ge307XG4gICAgfVxuXG4gICAgdGhpcy5fZW1pdHRlZEV2ZW50cyA9IHt9O1xuICAgIGlmKGRldGFjaGVkKXtcbiAgICAgICAgdGhpcy5fbW9kZWwgPSB7fTtcbiAgICB9ZWxzZXtcbiAgICAgICAgdGhpcy5hdHRhY2gobW9kZWwpO1xuICAgIH1cblxuICAgIHRoaXMub24oJ25ld0xpc3RlbmVyJywgZnVuY3Rpb24oKXtcbiAgICAgICAgbW9kaWZpZWRFbnRpZXMuYWRkKHRoaXMpO1xuICAgIH0pO1xufVxuRW50aS5nZXQgPSBmdW5jdGlvbihtb2RlbCwga2V5KXtcbiAgICBpZighbW9kZWwgfHwgdHlwZW9mIG1vZGVsICE9PSAnb2JqZWN0Jyl7XG4gICAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICBrZXkgPSBnZXRUYXJnZXRLZXkoa2V5KTtcblxuICAgIGlmKGtleSA9PT0gJy4nKXtcbiAgICAgICAgcmV0dXJuIG1vZGVsO1xuICAgIH1cblxuXG4gICAgdmFyIHBhdGggPSBsZWZ0QW5kUmVzdChrZXkpO1xuICAgIGlmKEFycmF5LmlzQXJyYXkocGF0aCkpe1xuICAgICAgICByZXR1cm4gRW50aS5nZXQobW9kZWxbcGF0aFswXV0sIHBhdGhbMV0pO1xuICAgIH1cblxuICAgIHJldHVybiBtb2RlbFtrZXldO1xufTtcbkVudGkuc2V0ID0gZnVuY3Rpb24obW9kZWwsIGtleSwgdmFsdWUpe1xuICAgIGlmKCFtb2RlbCB8fCB0eXBlb2YgbW9kZWwgIT09ICdvYmplY3QnKXtcbiAgICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIGtleSA9IGdldFRhcmdldEtleShrZXkpO1xuXG4gICAgdmFyIHBhdGggPSBsZWZ0QW5kUmVzdChrZXkpO1xuICAgIGlmKEFycmF5LmlzQXJyYXkocGF0aCkpe1xuICAgICAgICByZXR1cm4gRW50aS5zZXQobW9kZWxbcGF0aFswXV0sIHBhdGhbMV0sIHZhbHVlKTtcbiAgICB9XG5cbiAgICB2YXIgb3JpZ2luYWwgPSBtb2RlbFtrZXldO1xuXG4gICAgaWYodHlwZW9mIHZhbHVlICE9PSAnb2JqZWN0JyAmJiB2YWx1ZSA9PT0gb3JpZ2luYWwpe1xuICAgICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgdmFyIGtleXNDaGFuZ2VkID0gIShrZXkgaW4gbW9kZWwpO1xuXG4gICAgbW9kZWxba2V5XSA9IHZhbHVlO1xuXG4gICAgdmFyIGV2ZW50cyA9IFtbbW9kZWwsIGtleSwgdmFsdWVdXTtcblxuICAgIGlmKGtleXNDaGFuZ2VkKXtcbiAgICAgICAgaWYoQXJyYXkuaXNBcnJheShtb2RlbCkpe1xuICAgICAgICAgICAgZXZlbnRzLnB1c2goW21vZGVsLCAnbGVuZ3RoJywgbW9kZWwubGVuZ3RoXSk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBlbWl0KGV2ZW50cyk7XG59O1xuRW50aS5wdXNoID0gZnVuY3Rpb24obW9kZWwsIGtleSwgdmFsdWUpe1xuICAgIGlmKCFtb2RlbCB8fCB0eXBlb2YgbW9kZWwgIT09ICdvYmplY3QnKXtcbiAgICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIHZhciB0YXJnZXQ7XG4gICAgaWYoYXJndW1lbnRzLmxlbmd0aCA8IDMpe1xuICAgICAgICB2YWx1ZSA9IGtleTtcbiAgICAgICAga2V5ID0gJy4nO1xuICAgICAgICB0YXJnZXQgPSBtb2RlbDtcbiAgICB9ZWxzZXtcbiAgICAgICAgdmFyIHBhdGggPSBsZWZ0QW5kUmVzdChrZXkpO1xuICAgICAgICBpZihBcnJheS5pc0FycmF5KHBhdGgpKXtcbiAgICAgICAgICAgIHJldHVybiBFbnRpLnB1c2gobW9kZWxbcGF0aFswXV0sIHBhdGhbMV0sIHZhbHVlKTtcbiAgICAgICAgfVxuXG4gICAgICAgIHRhcmdldCA9IG1vZGVsW2tleV07XG4gICAgfVxuXG4gICAgaWYoIUFycmF5LmlzQXJyYXkodGFyZ2V0KSl7XG4gICAgICAgIHRocm93ICdUaGUgdGFyZ2V0IGlzIG5vdCBhbiBhcnJheS4nO1xuICAgIH1cblxuICAgIHRhcmdldC5wdXNoKHZhbHVlKTtcblxuICAgIHZhciBldmVudHMgPSBbXG4gICAgICAgIFt0YXJnZXQsIHRhcmdldC5sZW5ndGgtMSwgdmFsdWVdLFxuICAgICAgICBbdGFyZ2V0LCAnbGVuZ3RoJywgdGFyZ2V0Lmxlbmd0aF1cbiAgICBdO1xuXG4gICAgZW1pdChldmVudHMpO1xufTtcbkVudGkuaW5zZXJ0ID0gZnVuY3Rpb24obW9kZWwsIGtleSwgdmFsdWUsIGluZGV4KXtcbiAgICBpZighbW9kZWwgfHwgdHlwZW9mIG1vZGVsICE9PSAnb2JqZWN0Jyl7XG4gICAgICAgIHJldHVybjtcbiAgICB9XG5cblxuICAgIHZhciB0YXJnZXQ7XG4gICAgaWYoYXJndW1lbnRzLmxlbmd0aCA8IDQpe1xuICAgICAgICBpbmRleCA9IHZhbHVlO1xuICAgICAgICB2YWx1ZSA9IGtleTtcbiAgICAgICAga2V5ID0gJy4nO1xuICAgICAgICB0YXJnZXQgPSBtb2RlbDtcbiAgICB9ZWxzZXtcbiAgICAgICAgdmFyIHBhdGggPSBsZWZ0QW5kUmVzdChrZXkpO1xuICAgICAgICBpZihBcnJheS5pc0FycmF5KHBhdGgpKXtcbiAgICAgICAgICAgIHJldHVybiBFbnRpLmluc2VydChtb2RlbFtwYXRoWzBdXSwgcGF0aFsxXSwgdmFsdWUsIGluZGV4KTtcbiAgICAgICAgfVxuXG4gICAgICAgIHRhcmdldCA9IG1vZGVsW2tleV07XG4gICAgfVxuXG4gICAgaWYoIUFycmF5LmlzQXJyYXkodGFyZ2V0KSl7XG4gICAgICAgIHRocm93ICdUaGUgdGFyZ2V0IGlzIG5vdCBhbiBhcnJheS4nO1xuICAgIH1cblxuICAgIHRhcmdldC5zcGxpY2UoaW5kZXgsIDAsIHZhbHVlKTtcblxuICAgIHZhciBldmVudHMgPSBbXG4gICAgICAgIFt0YXJnZXQsIGluZGV4LCB2YWx1ZV0sXG4gICAgICAgIFt0YXJnZXQsICdsZW5ndGgnLCB0YXJnZXQubGVuZ3RoXVxuICAgIF07XG5cbiAgICBlbWl0KGV2ZW50cyk7XG59O1xuRW50aS5yZW1vdmUgPSBmdW5jdGlvbihtb2RlbCwga2V5LCBzdWJLZXkpe1xuICAgIGlmKCFtb2RlbCB8fCB0eXBlb2YgbW9kZWwgIT09ICdvYmplY3QnKXtcbiAgICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIHZhciBwYXRoID0gbGVmdEFuZFJlc3Qoa2V5KTtcbiAgICBpZihBcnJheS5pc0FycmF5KHBhdGgpKXtcbiAgICAgICAgcmV0dXJuIEVudGkucmVtb3ZlKG1vZGVsW3BhdGhbMF1dLCBwYXRoWzFdLCBzdWJLZXkpO1xuICAgIH1cblxuICAgIC8vIFJlbW92ZSBhIGtleSBvZmYgb2YgYW4gb2JqZWN0IGF0ICdrZXknXG4gICAgaWYoc3ViS2V5ICE9IG51bGwpe1xuICAgICAgICBFbnRpLnJlbW92ZShtb2RlbFtrZXldLCBzdWJLZXkpO1xuICAgICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgaWYoa2V5ID09PSAnLicpe1xuICAgICAgICB0aHJvdyAnLiAoc2VsZikgaXMgbm90IGEgdmFsaWQga2V5IHRvIHJlbW92ZSc7XG4gICAgfVxuXG4gICAgdmFyIGV2ZW50cyA9IFtdO1xuXG4gICAgaWYoQXJyYXkuaXNBcnJheShtb2RlbCkpe1xuICAgICAgICBtb2RlbC5zcGxpY2Uoa2V5LCAxKTtcbiAgICAgICAgZXZlbnRzLnB1c2goW21vZGVsLCAnbGVuZ3RoJywgbW9kZWwubGVuZ3RoXSk7XG4gICAgfWVsc2V7XG4gICAgICAgIGRlbGV0ZSBtb2RlbFtrZXldO1xuICAgICAgICBldmVudHMucHVzaChbbW9kZWwsIGtleV0pO1xuICAgIH1cblxuICAgIGVtaXQoZXZlbnRzKTtcbn07XG5FbnRpLm1vdmUgPSBmdW5jdGlvbihtb2RlbCwga2V5LCBpbmRleCl7XG4gICAgaWYoIW1vZGVsIHx8IHR5cGVvZiBtb2RlbCAhPT0gJ29iamVjdCcpe1xuICAgICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgdmFyIHBhdGggPSBsZWZ0QW5kUmVzdChrZXkpO1xuICAgIGlmKEFycmF5LmlzQXJyYXkocGF0aCkpe1xuICAgICAgICByZXR1cm4gRW50aS5tb3ZlKG1vZGVsW3BhdGhbMF1dLCBwYXRoWzFdLCBpbmRleCk7XG4gICAgfVxuXG4gICAgaWYoa2V5ID09PSBpbmRleCl7XG4gICAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICBpZighQXJyYXkuaXNBcnJheShtb2RlbCkpe1xuICAgICAgICB0aHJvdyAnVGhlIG1vZGVsIGlzIG5vdCBhbiBhcnJheS4nO1xuICAgIH1cblxuICAgIHZhciBpdGVtID0gbW9kZWxba2V5XTtcblxuICAgIG1vZGVsLnNwbGljZShrZXksIDEpO1xuXG4gICAgbW9kZWwuc3BsaWNlKGluZGV4IC0gKGluZGV4ID4ga2V5ID8gMCA6IDEpLCAwLCBpdGVtKTtcblxuICAgIGVtaXQoW1ttb2RlbCwgaW5kZXgsIGl0ZW1dXSk7XG59O1xuRW50aS51cGRhdGUgPSBmdW5jdGlvbihtb2RlbCwga2V5LCB2YWx1ZSl7XG4gICAgaWYoIW1vZGVsIHx8IHR5cGVvZiBtb2RlbCAhPT0gJ29iamVjdCcpe1xuICAgICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgdmFyIHRhcmdldCxcbiAgICAgICAgaXNBcnJheSA9IEFycmF5LmlzQXJyYXkodmFsdWUpO1xuXG4gICAgaWYoYXJndW1lbnRzLmxlbmd0aCA8IDMpe1xuICAgICAgICB2YWx1ZSA9IGtleTtcbiAgICAgICAga2V5ID0gJy4nO1xuICAgICAgICB0YXJnZXQgPSBtb2RlbDtcbiAgICB9ZWxzZXtcbiAgICAgICAgdmFyIHBhdGggPSBsZWZ0QW5kUmVzdChrZXkpO1xuICAgICAgICBpZihBcnJheS5pc0FycmF5KHBhdGgpKXtcbiAgICAgICAgICAgIHJldHVybiBFbnRpLnVwZGF0ZShtb2RlbFtwYXRoWzBdXSwgcGF0aFsxXSwgdmFsdWUpO1xuICAgICAgICB9XG5cbiAgICAgICAgdGFyZ2V0ID0gbW9kZWxba2V5XTtcblxuICAgICAgICBpZih0YXJnZXQgPT0gbnVsbCl7XG4gICAgICAgICAgICBtb2RlbFtrZXldID0gaXNBcnJheSA/IFtdIDoge307XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBpZih0eXBlb2YgdmFsdWUgIT09ICdvYmplY3QnKXtcbiAgICAgICAgdGhyb3cgJ1RoZSB2YWx1ZSBpcyBub3QgYW4gb2JqZWN0Lic7XG4gICAgfVxuXG4gICAgaWYodHlwZW9mIHRhcmdldCAhPT0gJ29iamVjdCcpe1xuICAgICAgICB0aHJvdyAnVGhlIHRhcmdldCBpcyBub3QgYW4gb2JqZWN0Lic7XG4gICAgfVxuXG4gICAgdmFyIGV2ZW50cyA9IFtdLFxuICAgICAgICB1cGRhdGVkT2JqZWN0cyA9IG5ldyBXZWFrU2V0KCk7XG5cbiAgICBmdW5jdGlvbiB1cGRhdGVUYXJnZXQodGFyZ2V0LCB2YWx1ZSl7XG4gICAgICAgIGZvcih2YXIga2V5IGluIHZhbHVlKXtcbiAgICAgICAgICAgIHZhciBjdXJyZW50VmFsdWUgPSB0YXJnZXRba2V5XTtcbiAgICAgICAgICAgIGlmKGN1cnJlbnRWYWx1ZSBpbnN0YW5jZW9mIE9iamVjdCAmJiAhdXBkYXRlZE9iamVjdHMuaGFzKGN1cnJlbnRWYWx1ZSkpe1xuICAgICAgICAgICAgICAgIHVwZGF0ZWRPYmplY3RzLmFkZChjdXJyZW50VmFsdWUpO1xuICAgICAgICAgICAgICAgIHVwZGF0ZVRhcmdldChjdXJyZW50VmFsdWUsIHZhbHVlW2tleV0pO1xuICAgICAgICAgICAgICAgIGNvbnRpbnVlO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgdGFyZ2V0W2tleV0gPSB2YWx1ZVtrZXldO1xuICAgICAgICAgICAgZXZlbnRzLnB1c2goW3RhcmdldCwga2V5LCB2YWx1ZVtrZXldXSk7XG4gICAgICAgIH1cblxuICAgICAgICBpZihBcnJheS5pc0FycmF5KHRhcmdldCkpe1xuICAgICAgICAgICAgZXZlbnRzLnB1c2goW3RhcmdldCwgJ2xlbmd0aCcsIHRhcmdldC5sZW5ndGhdKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIHVwZGF0ZVRhcmdldCh0YXJnZXQsIHZhbHVlKTtcblxuICAgIGVtaXQoZXZlbnRzKTtcbn07XG5FbnRpLnByb3RvdHlwZSA9IE9iamVjdC5jcmVhdGUoRXZlbnRFbWl0dGVyLnByb3RvdHlwZSk7XG5FbnRpLnByb3RvdHlwZS5fbWF4TGlzdGVuZXJzID0gMTAwO1xuRW50aS5wcm90b3R5cGUuY29uc3RydWN0b3IgPSBFbnRpO1xuRW50aS5wcm90b3R5cGUuYXR0YWNoID0gZnVuY3Rpb24obW9kZWwpe1xuICAgIGlmKHRoaXMuX21vZGVsICE9PSBtb2RlbCl7XG4gICAgICAgIHRoaXMuZGV0YWNoKCk7XG4gICAgfVxuXG4gICAgbW9kaWZpZWRFbnRpZXMuYWRkKHRoaXMpO1xuICAgIHRoaXMuX2F0dGFjaGVkID0gdHJ1ZTtcbiAgICB0aGlzLl9tb2RlbCA9IG1vZGVsO1xuICAgIHRoaXMuZW1pdCgnYXR0YWNoJywgbW9kZWwpO1xufTtcbkVudGkucHJvdG90eXBlLmRldGFjaCA9IGZ1bmN0aW9uKCl7XG4gICAgbW9kaWZpZWRFbnRpZXMuZGVsZXRlKHRoaXMpO1xuXG4gICAgdGhpcy5fZW1pdHRlZEV2ZW50cyA9IHt9O1xuICAgIHRoaXMuX21vZGVsID0ge307XG4gICAgdGhpcy5fYXR0YWNoZWQgPSBmYWxzZTtcbiAgICB0aGlzLmVtaXQoJ2RldGFjaCcpO1xufTtcbkVudGkucHJvdG90eXBlLmRlc3Ryb3kgPSBmdW5jdGlvbigpe1xuICAgIHRoaXMuZGV0YWNoKCk7XG4gICAgdGhpcy5fZXZlbnRzID0gbnVsbDtcbiAgICB0aGlzLmVtaXQoJ2Rlc3Ryb3knKTtcbn07XG5FbnRpLnByb3RvdHlwZS5nZXQgPSBmdW5jdGlvbihrZXkpe1xuICAgIHJldHVybiBFbnRpLmdldCh0aGlzLl9tb2RlbCwga2V5KTtcbn07XG5cbkVudGkucHJvdG90eXBlLnNldCA9IGZ1bmN0aW9uKGtleSwgdmFsdWUpe1xuICAgIHJldHVybiBFbnRpLnNldCh0aGlzLl9tb2RlbCwga2V5LCB2YWx1ZSk7XG59O1xuXG5FbnRpLnByb3RvdHlwZS5wdXNoID0gZnVuY3Rpb24oa2V5LCB2YWx1ZSl7XG4gICAgcmV0dXJuIEVudGkucHVzaC5hcHBseShudWxsLCBbdGhpcy5fbW9kZWxdLmNvbmNhdCh0b0FycmF5KGFyZ3VtZW50cykpKTtcbn07XG5cbkVudGkucHJvdG90eXBlLmluc2VydCA9IGZ1bmN0aW9uKGtleSwgdmFsdWUsIGluZGV4KXtcbiAgICByZXR1cm4gRW50aS5pbnNlcnQuYXBwbHkobnVsbCwgW3RoaXMuX21vZGVsXS5jb25jYXQodG9BcnJheShhcmd1bWVudHMpKSk7XG59O1xuXG5FbnRpLnByb3RvdHlwZS5yZW1vdmUgPSBmdW5jdGlvbihrZXksIHN1YktleSl7XG4gICAgcmV0dXJuIEVudGkucmVtb3ZlLmFwcGx5KG51bGwsIFt0aGlzLl9tb2RlbF0uY29uY2F0KHRvQXJyYXkoYXJndW1lbnRzKSkpO1xufTtcblxuRW50aS5wcm90b3R5cGUubW92ZSA9IGZ1bmN0aW9uKGtleSwgaW5kZXgpe1xuICAgIHJldHVybiBFbnRpLm1vdmUuYXBwbHkobnVsbCwgW3RoaXMuX21vZGVsXS5jb25jYXQodG9BcnJheShhcmd1bWVudHMpKSk7XG59O1xuXG5FbnRpLnByb3RvdHlwZS51cGRhdGUgPSBmdW5jdGlvbihrZXksIGluZGV4KXtcbiAgICByZXR1cm4gRW50aS51cGRhdGUuYXBwbHkobnVsbCwgW3RoaXMuX21vZGVsXS5jb25jYXQodG9BcnJheShhcmd1bWVudHMpKSk7XG59O1xuRW50aS5wcm90b3R5cGUuaXNBdHRhY2hlZCA9IGZ1bmN0aW9uKCl7XG4gICAgcmV0dXJuIHRoaXMuX2F0dGFjaGVkO1xufTtcbkVudGkucHJvdG90eXBlLmF0dGFjaGVkQ291bnQgPSBmdW5jdGlvbigpe1xuICAgIHJldHVybiBtb2RpZmllZEVudGllcy5zaXplO1xufTtcblxuRW50aS5pc0VudGkgPSBmdW5jdGlvbih0YXJnZXQpe1xuICAgIHJldHVybiB0YXJnZXQgJiYgISF+Z2xvYmFsU3RhdGUuaW5zdGFuY2VzLmluZGV4T2YodGFyZ2V0LmNvbnN0cnVjdG9yKTtcbn07XG5cbkVudGkuc3RvcmUgPSBmdW5jdGlvbih0YXJnZXQsIGtleSwgdmFsdWUpe1xuICAgIGlmKGFyZ3VtZW50cy5sZW5ndGggPCAyKXtcbiAgICAgICAgcmV0dXJuIEVudGkuZ2V0KHRhcmdldCwga2V5KTtcbiAgICB9XG5cbiAgICBFbnRpLnNldCh0YXJnZXQsIGtleSwgdmFsdWUpO1xufTtcblxuZ2xvYmFsU3RhdGUuaW5zdGFuY2VzLnB1c2goRW50aSk7XG5cbm1vZHVsZS5leHBvcnRzID0gRW50aTtcbiIsIid1c2Ugc3RyaWN0JztcbnZhciBwcm9wSXNFbnVtZXJhYmxlID0gT2JqZWN0LnByb3RvdHlwZS5wcm9wZXJ0eUlzRW51bWVyYWJsZTtcblxuZnVuY3Rpb24gVG9PYmplY3QodmFsKSB7XG5cdGlmICh2YWwgPT0gbnVsbCkge1xuXHRcdHRocm93IG5ldyBUeXBlRXJyb3IoJ09iamVjdC5hc3NpZ24gY2Fubm90IGJlIGNhbGxlZCB3aXRoIG51bGwgb3IgdW5kZWZpbmVkJyk7XG5cdH1cblxuXHRyZXR1cm4gT2JqZWN0KHZhbCk7XG59XG5cbmZ1bmN0aW9uIG93bkVudW1lcmFibGVLZXlzKG9iaikge1xuXHR2YXIga2V5cyA9IE9iamVjdC5nZXRPd25Qcm9wZXJ0eU5hbWVzKG9iaik7XG5cblx0aWYgKE9iamVjdC5nZXRPd25Qcm9wZXJ0eVN5bWJvbHMpIHtcblx0XHRrZXlzID0ga2V5cy5jb25jYXQoT2JqZWN0LmdldE93blByb3BlcnR5U3ltYm9scyhvYmopKTtcblx0fVxuXG5cdHJldHVybiBrZXlzLmZpbHRlcihmdW5jdGlvbiAoa2V5KSB7XG5cdFx0cmV0dXJuIHByb3BJc0VudW1lcmFibGUuY2FsbChvYmosIGtleSk7XG5cdH0pO1xufVxuXG5tb2R1bGUuZXhwb3J0cyA9IE9iamVjdC5hc3NpZ24gfHwgZnVuY3Rpb24gKHRhcmdldCwgc291cmNlKSB7XG5cdHZhciBmcm9tO1xuXHR2YXIga2V5cztcblx0dmFyIHRvID0gVG9PYmplY3QodGFyZ2V0KTtcblxuXHRmb3IgKHZhciBzID0gMTsgcyA8IGFyZ3VtZW50cy5sZW5ndGg7IHMrKykge1xuXHRcdGZyb20gPSBhcmd1bWVudHNbc107XG5cdFx0a2V5cyA9IG93bkVudW1lcmFibGVLZXlzKE9iamVjdChmcm9tKSk7XG5cblx0XHRmb3IgKHZhciBpID0gMDsgaSA8IGtleXMubGVuZ3RoOyBpKyspIHtcblx0XHRcdHRvW2tleXNbaV1dID0gZnJvbVtrZXlzW2ldXTtcblx0XHR9XG5cdH1cblxuXHRyZXR1cm4gdG87XG59O1xuIiwibW9kdWxlLmV4cG9ydHMgPSBmdW5jdGlvbiBpc1NhbWUoYSwgYil7XG4gICAgaWYoYSA9PT0gYil7XG4gICAgICAgIHJldHVybiB0cnVlO1xuICAgIH1cblxuICAgIGlmKFxuICAgICAgICB0eXBlb2YgYSAhPT0gdHlwZW9mIGIgfHxcbiAgICAgICAgdHlwZW9mIGEgPT09ICdvYmplY3QnICYmXG4gICAgICAgICEoYSBpbnN0YW5jZW9mIERhdGUgJiYgYiBpbnN0YW5jZW9mIERhdGUpXG4gICAgKXtcbiAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgIH1cblxuICAgIHJldHVybiBTdHJpbmcoYSkgPT09IFN0cmluZyhiKTtcbn07IiwidmFyIG5hdHVyYWxTZWxlY3Rpb24gPSByZXF1aXJlKCduYXR1cmFsLXNlbGVjdGlvbicpO1xuXG5tb2R1bGUuZXhwb3J0cyA9IGZ1bmN0aW9uKGVsZW1lbnQsIHZhbHVlKXtcbiAgICB2YXIgY2FuU2V0ID0gbmF0dXJhbFNlbGVjdGlvbihlbGVtZW50KSAmJiBlbGVtZW50ID09PSBkb2N1bWVudC5hY3RpdmVFbGVtZW50O1xuXG4gICAgaWYgKGNhblNldCkge1xuICAgICAgICB2YXIgc3RhcnQgPSBlbGVtZW50LnNlbGVjdGlvblN0YXJ0LFxuICAgICAgICAgICAgZW5kID0gZWxlbWVudC5zZWxlY3Rpb25FbmQ7XG5cbiAgICAgICAgZWxlbWVudC52YWx1ZSA9IHZhbHVlO1xuICAgICAgICBlbGVtZW50LnNldFNlbGVjdGlvblJhbmdlKHN0YXJ0LCBlbmQpO1xuICAgIH0gZWxzZSB7XG4gICAgICAgIGVsZW1lbnQudmFsdWUgPSB2YWx1ZTtcbiAgICB9XG59O1xuIiwidmFyIHN1cHBvcnRlZFR5cGVzID0gWyd0ZXh0JywgJ3NlYXJjaCcsICd0ZWwnLCAndXJsJywgJ3Bhc3N3b3JkJ107XG5cbm1vZHVsZS5leHBvcnRzID0gZnVuY3Rpb24oZWxlbWVudCl7XG4gICAgcmV0dXJuICEhKGVsZW1lbnQuc2V0U2VsZWN0aW9uUmFuZ2UgJiYgfnN1cHBvcnRlZFR5cGVzLmluZGV4T2YoZWxlbWVudC50eXBlKSk7XG59O1xuIiwibW9kdWxlLmV4cG9ydHMgPSBPYmplY3Quc2V0UHJvdG90eXBlT2YgfHwge19fcHJvdG9fXzpbXX0gaW5zdGFuY2VvZiBBcnJheSA/IHNldFByb3RvT2YgOiBtaXhpblByb3BlcnRpZXM7XG5cbmZ1bmN0aW9uIHNldFByb3RvT2Yob2JqLCBwcm90bykge1xuXHRvYmouX19wcm90b19fID0gcHJvdG87XG59XG5cbmZ1bmN0aW9uIG1peGluUHJvcGVydGllcyhvYmosIHByb3RvKSB7XG5cdGZvciAodmFyIHByb3AgaW4gcHJvdG8pIHtcblx0XHRvYmpbcHJvcF0gPSBwcm90b1twcm9wXTtcblx0fVxufVxuIiwidmFyIGNsb25lID0gcmVxdWlyZSgnY2xvbmUnKSxcbiAgICBkZWVwRXF1YWwgPSByZXF1aXJlKCdkZWVwLWVxdWFsJyk7XG5cbmZ1bmN0aW9uIGtleXNBcmVEaWZmZXJlbnQoa2V5czEsIGtleXMyKXtcbiAgICBpZihrZXlzMSA9PT0ga2V5czIpe1xuICAgICAgICByZXR1cm47XG4gICAgfVxuICAgIGlmKCFrZXlzMSB8fCAha2V5czIgfHwga2V5czEubGVuZ3RoICE9PSBrZXlzMi5sZW5ndGgpe1xuICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICB9XG4gICAgZm9yKHZhciBpID0gMDsgaSA8IGtleXMxLmxlbmd0aDsgaSsrKXtcbiAgICAgICAgaWYoIX5rZXlzMi5pbmRleE9mKGtleXMxW2ldKSl7XG4gICAgICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICAgICAgfVxuICAgIH1cbn1cblxuZnVuY3Rpb24gZ2V0S2V5cyh2YWx1ZSl7XG4gICAgaWYoIXZhbHVlIHx8IHR5cGVvZiB2YWx1ZSAhPT0gJ29iamVjdCcpe1xuICAgICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgcmV0dXJuIE9iamVjdC5rZXlzKHZhbHVlKTtcbn1cblxuZnVuY3Rpb24gV2hhdENoYW5nZWQodmFsdWUsIGNoYW5nZXNUb1RyYWNrKXtcbiAgICB0aGlzLl9jaGFuZ2VzVG9UcmFjayA9IHt9O1xuXG4gICAgaWYoY2hhbmdlc1RvVHJhY2sgPT0gbnVsbCl7XG4gICAgICAgIGNoYW5nZXNUb1RyYWNrID0gJ3ZhbHVlIHR5cGUga2V5cyBzdHJ1Y3R1cmUgcmVmZXJlbmNlJztcbiAgICB9XG5cbiAgICBpZih0eXBlb2YgY2hhbmdlc1RvVHJhY2sgIT09ICdzdHJpbmcnKXtcbiAgICAgICAgdGhyb3cgJ2NoYW5nZXNUb1RyYWNrIG11c3QgYmUgb2YgdHlwZSBzdHJpbmcnO1xuICAgIH1cblxuICAgIGNoYW5nZXNUb1RyYWNrID0gY2hhbmdlc1RvVHJhY2suc3BsaXQoJyAnKTtcblxuICAgIGZvciAodmFyIGkgPSAwOyBpIDwgY2hhbmdlc1RvVHJhY2subGVuZ3RoOyBpKyspIHtcbiAgICAgICAgdGhpcy5fY2hhbmdlc1RvVHJhY2tbY2hhbmdlc1RvVHJhY2tbaV1dID0gdHJ1ZTtcbiAgICB9O1xuXG4gICAgdGhpcy51cGRhdGUodmFsdWUpO1xufVxuV2hhdENoYW5nZWQucHJvdG90eXBlLnVwZGF0ZSA9IGZ1bmN0aW9uKHZhbHVlKXtcbiAgICB2YXIgcmVzdWx0ID0ge30sXG4gICAgICAgIGNoYW5nZXNUb1RyYWNrID0gdGhpcy5fY2hhbmdlc1RvVHJhY2ssXG4gICAgICAgIG5ld0tleXMgPSBnZXRLZXlzKHZhbHVlKTtcblxuICAgIGlmKCd2YWx1ZScgaW4gY2hhbmdlc1RvVHJhY2sgJiYgdmFsdWUrJycgIT09IHRoaXMuX2xhc3RSZWZlcmVuY2UrJycpe1xuICAgICAgICByZXN1bHQudmFsdWUgPSB0cnVlO1xuICAgIH1cbiAgICBpZihcbiAgICAgICAgJ3R5cGUnIGluIGNoYW5nZXNUb1RyYWNrICYmIHR5cGVvZiB2YWx1ZSAhPT0gdHlwZW9mIHRoaXMuX2xhc3RWYWx1ZSB8fFxuICAgICAgICAodmFsdWUgPT09IG51bGwgfHwgdGhpcy5fbGFzdFZhbHVlID09PSBudWxsKSAmJiB0aGlzLnZhbHVlICE9PSB0aGlzLl9sYXN0VmFsdWUgLy8gdHlwZW9mIG51bGwgPT09ICdvYmplY3QnXG4gICAgKXtcbiAgICAgICAgcmVzdWx0LnR5cGUgPSB0cnVlO1xuICAgIH1cbiAgICBpZigna2V5cycgaW4gY2hhbmdlc1RvVHJhY2sgJiYga2V5c0FyZURpZmZlcmVudCh0aGlzLl9sYXN0S2V5cywgZ2V0S2V5cyh2YWx1ZSkpKXtcbiAgICAgICAgcmVzdWx0LmtleXMgPSB0cnVlO1xuICAgIH1cblxuICAgIGlmKHZhbHVlICE9PSBudWxsICYmIHR5cGVvZiB2YWx1ZSA9PT0gJ29iamVjdCcgfHwgdHlwZW9mIHZhbHVlID09PSAnZnVuY3Rpb24nKXtcbiAgICAgICAgdmFyIGxhc3RWYWx1ZSA9IHRoaXMuX2xhc3RWYWx1ZTtcblxuICAgICAgICBpZignc2hhbGxvd1N0cnVjdHVyZScgaW4gY2hhbmdlc1RvVHJhY2sgJiYgKCFsYXN0VmFsdWUgfHwgdHlwZW9mIGxhc3RWYWx1ZSAhPT0gJ29iamVjdCcgfHwgT2JqZWN0LmtleXModmFsdWUpLnNvbWUoZnVuY3Rpb24oa2V5LCBpbmRleCl7XG4gICAgICAgICAgICByZXR1cm4gdmFsdWVba2V5XSAhPT0gbGFzdFZhbHVlW2tleV07XG4gICAgICAgIH0pKSl7XG4gICAgICAgICAgICByZXN1bHQuc2hhbGxvd1N0cnVjdHVyZSA9IHRydWU7XG4gICAgICAgIH1cbiAgICAgICAgaWYoJ3N0cnVjdHVyZScgaW4gY2hhbmdlc1RvVHJhY2sgJiYgIWRlZXBFcXVhbCh2YWx1ZSwgbGFzdFZhbHVlKSl7XG4gICAgICAgICAgICByZXN1bHQuc3RydWN0dXJlID0gdHJ1ZTtcbiAgICAgICAgfVxuICAgICAgICBpZigncmVmZXJlbmNlJyBpbiBjaGFuZ2VzVG9UcmFjayAmJiB2YWx1ZSAhPT0gdGhpcy5fbGFzdFJlZmVyZW5jZSl7XG4gICAgICAgICAgICByZXN1bHQucmVmZXJlbmNlID0gdHJ1ZTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIHRoaXMuX2xhc3RWYWx1ZSA9ICdzdHJ1Y3R1cmUnIGluIGNoYW5nZXNUb1RyYWNrID8gY2xvbmUodmFsdWUpIDogJ3NoYWxsb3dTdHJ1Y3R1cmUnIGluIGNoYW5nZXNUb1RyYWNrID8gY2xvbmUodmFsdWUsIHRydWUsIDEpOiB2YWx1ZTtcbiAgICB0aGlzLl9sYXN0UmVmZXJlbmNlID0gdmFsdWU7XG4gICAgdGhpcy5fbGFzdEtleXMgPSBuZXdLZXlzO1xuXG4gICAgcmV0dXJuIHJlc3VsdDtcbn07XG5cbm1vZHVsZS5leHBvcnRzID0gV2hhdENoYW5nZWQ7IiwidmFyIGNsb25lID0gKGZ1bmN0aW9uKCkge1xuJ3VzZSBzdHJpY3QnO1xuXG4vKipcbiAqIENsb25lcyAoY29waWVzKSBhbiBPYmplY3QgdXNpbmcgZGVlcCBjb3B5aW5nLlxuICpcbiAqIFRoaXMgZnVuY3Rpb24gc3VwcG9ydHMgY2lyY3VsYXIgcmVmZXJlbmNlcyBieSBkZWZhdWx0LCBidXQgaWYgeW91IGFyZSBjZXJ0YWluXG4gKiB0aGVyZSBhcmUgbm8gY2lyY3VsYXIgcmVmZXJlbmNlcyBpbiB5b3VyIG9iamVjdCwgeW91IGNhbiBzYXZlIHNvbWUgQ1BVIHRpbWVcbiAqIGJ5IGNhbGxpbmcgY2xvbmUob2JqLCBmYWxzZSkuXG4gKlxuICogQ2F1dGlvbjogaWYgYGNpcmN1bGFyYCBpcyBmYWxzZSBhbmQgYHBhcmVudGAgY29udGFpbnMgY2lyY3VsYXIgcmVmZXJlbmNlcyxcbiAqIHlvdXIgcHJvZ3JhbSBtYXkgZW50ZXIgYW4gaW5maW5pdGUgbG9vcCBhbmQgY3Jhc2guXG4gKlxuICogQHBhcmFtIGBwYXJlbnRgIC0gdGhlIG9iamVjdCB0byBiZSBjbG9uZWRcbiAqIEBwYXJhbSBgY2lyY3VsYXJgIC0gc2V0IHRvIHRydWUgaWYgdGhlIG9iamVjdCB0byBiZSBjbG9uZWQgbWF5IGNvbnRhaW5cbiAqICAgIGNpcmN1bGFyIHJlZmVyZW5jZXMuIChvcHRpb25hbCAtIHRydWUgYnkgZGVmYXVsdClcbiAqIEBwYXJhbSBgZGVwdGhgIC0gc2V0IHRvIGEgbnVtYmVyIGlmIHRoZSBvYmplY3QgaXMgb25seSB0byBiZSBjbG9uZWQgdG9cbiAqICAgIGEgcGFydGljdWxhciBkZXB0aC4gKG9wdGlvbmFsIC0gZGVmYXVsdHMgdG8gSW5maW5pdHkpXG4gKiBAcGFyYW0gYHByb3RvdHlwZWAgLSBzZXRzIHRoZSBwcm90b3R5cGUgdG8gYmUgdXNlZCB3aGVuIGNsb25pbmcgYW4gb2JqZWN0LlxuICogICAgKG9wdGlvbmFsIC0gZGVmYXVsdHMgdG8gcGFyZW50IHByb3RvdHlwZSkuXG4qL1xuZnVuY3Rpb24gY2xvbmUocGFyZW50LCBjaXJjdWxhciwgZGVwdGgsIHByb3RvdHlwZSkge1xuICB2YXIgZmlsdGVyO1xuICBpZiAodHlwZW9mIGNpcmN1bGFyID09PSAnb2JqZWN0Jykge1xuICAgIGRlcHRoID0gY2lyY3VsYXIuZGVwdGg7XG4gICAgcHJvdG90eXBlID0gY2lyY3VsYXIucHJvdG90eXBlO1xuICAgIGZpbHRlciA9IGNpcmN1bGFyLmZpbHRlcjtcbiAgICBjaXJjdWxhciA9IGNpcmN1bGFyLmNpcmN1bGFyXG4gIH1cbiAgLy8gbWFpbnRhaW4gdHdvIGFycmF5cyBmb3IgY2lyY3VsYXIgcmVmZXJlbmNlcywgd2hlcmUgY29ycmVzcG9uZGluZyBwYXJlbnRzXG4gIC8vIGFuZCBjaGlsZHJlbiBoYXZlIHRoZSBzYW1lIGluZGV4XG4gIHZhciBhbGxQYXJlbnRzID0gW107XG4gIHZhciBhbGxDaGlsZHJlbiA9IFtdO1xuXG4gIHZhciB1c2VCdWZmZXIgPSB0eXBlb2YgQnVmZmVyICE9ICd1bmRlZmluZWQnO1xuXG4gIGlmICh0eXBlb2YgY2lyY3VsYXIgPT0gJ3VuZGVmaW5lZCcpXG4gICAgY2lyY3VsYXIgPSB0cnVlO1xuXG4gIGlmICh0eXBlb2YgZGVwdGggPT0gJ3VuZGVmaW5lZCcpXG4gICAgZGVwdGggPSBJbmZpbml0eTtcblxuICAvLyByZWN1cnNlIHRoaXMgZnVuY3Rpb24gc28gd2UgZG9uJ3QgcmVzZXQgYWxsUGFyZW50cyBhbmQgYWxsQ2hpbGRyZW5cbiAgZnVuY3Rpb24gX2Nsb25lKHBhcmVudCwgZGVwdGgpIHtcbiAgICAvLyBjbG9uaW5nIG51bGwgYWx3YXlzIHJldHVybnMgbnVsbFxuICAgIGlmIChwYXJlbnQgPT09IG51bGwpXG4gICAgICByZXR1cm4gbnVsbDtcblxuICAgIGlmIChkZXB0aCA9PSAwKVxuICAgICAgcmV0dXJuIHBhcmVudDtcblxuICAgIHZhciBjaGlsZDtcbiAgICB2YXIgcHJvdG87XG4gICAgaWYgKHR5cGVvZiBwYXJlbnQgIT0gJ29iamVjdCcpIHtcbiAgICAgIHJldHVybiBwYXJlbnQ7XG4gICAgfVxuXG4gICAgaWYgKGNsb25lLl9faXNBcnJheShwYXJlbnQpKSB7XG4gICAgICBjaGlsZCA9IFtdO1xuICAgIH0gZWxzZSBpZiAoY2xvbmUuX19pc1JlZ0V4cChwYXJlbnQpKSB7XG4gICAgICBjaGlsZCA9IG5ldyBSZWdFeHAocGFyZW50LnNvdXJjZSwgX19nZXRSZWdFeHBGbGFncyhwYXJlbnQpKTtcbiAgICAgIGlmIChwYXJlbnQubGFzdEluZGV4KSBjaGlsZC5sYXN0SW5kZXggPSBwYXJlbnQubGFzdEluZGV4O1xuICAgIH0gZWxzZSBpZiAoY2xvbmUuX19pc0RhdGUocGFyZW50KSkge1xuICAgICAgY2hpbGQgPSBuZXcgRGF0ZShwYXJlbnQuZ2V0VGltZSgpKTtcbiAgICB9IGVsc2UgaWYgKHVzZUJ1ZmZlciAmJiBCdWZmZXIuaXNCdWZmZXIocGFyZW50KSkge1xuICAgICAgY2hpbGQgPSBuZXcgQnVmZmVyKHBhcmVudC5sZW5ndGgpO1xuICAgICAgcGFyZW50LmNvcHkoY2hpbGQpO1xuICAgICAgcmV0dXJuIGNoaWxkO1xuICAgIH0gZWxzZSB7XG4gICAgICBpZiAodHlwZW9mIHByb3RvdHlwZSA9PSAndW5kZWZpbmVkJykge1xuICAgICAgICBwcm90byA9IE9iamVjdC5nZXRQcm90b3R5cGVPZihwYXJlbnQpO1xuICAgICAgICBjaGlsZCA9IE9iamVjdC5jcmVhdGUocHJvdG8pO1xuICAgICAgfVxuICAgICAgZWxzZSB7XG4gICAgICAgIGNoaWxkID0gT2JqZWN0LmNyZWF0ZShwcm90b3R5cGUpO1xuICAgICAgICBwcm90byA9IHByb3RvdHlwZTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICBpZiAoY2lyY3VsYXIpIHtcbiAgICAgIHZhciBpbmRleCA9IGFsbFBhcmVudHMuaW5kZXhPZihwYXJlbnQpO1xuXG4gICAgICBpZiAoaW5kZXggIT0gLTEpIHtcbiAgICAgICAgcmV0dXJuIGFsbENoaWxkcmVuW2luZGV4XTtcbiAgICAgIH1cbiAgICAgIGFsbFBhcmVudHMucHVzaChwYXJlbnQpO1xuICAgICAgYWxsQ2hpbGRyZW4ucHVzaChjaGlsZCk7XG4gICAgfVxuXG4gICAgZm9yICh2YXIgaSBpbiBwYXJlbnQpIHtcbiAgICAgIHZhciBhdHRycztcbiAgICAgIGlmIChwcm90bykge1xuICAgICAgICBhdHRycyA9IE9iamVjdC5nZXRPd25Qcm9wZXJ0eURlc2NyaXB0b3IocHJvdG8sIGkpO1xuICAgICAgfVxuXG4gICAgICBpZiAoYXR0cnMgJiYgYXR0cnMuc2V0ID09IG51bGwpIHtcbiAgICAgICAgY29udGludWU7XG4gICAgICB9XG4gICAgICBjaGlsZFtpXSA9IF9jbG9uZShwYXJlbnRbaV0sIGRlcHRoIC0gMSk7XG4gICAgfVxuXG4gICAgcmV0dXJuIGNoaWxkO1xuICB9XG5cbiAgcmV0dXJuIF9jbG9uZShwYXJlbnQsIGRlcHRoKTtcbn1cblxuLyoqXG4gKiBTaW1wbGUgZmxhdCBjbG9uZSB1c2luZyBwcm90b3R5cGUsIGFjY2VwdHMgb25seSBvYmplY3RzLCB1c2VmdWxsIGZvciBwcm9wZXJ0eVxuICogb3ZlcnJpZGUgb24gRkxBVCBjb25maWd1cmF0aW9uIG9iamVjdCAobm8gbmVzdGVkIHByb3BzKS5cbiAqXG4gKiBVU0UgV0lUSCBDQVVUSU9OISBUaGlzIG1heSBub3QgYmVoYXZlIGFzIHlvdSB3aXNoIGlmIHlvdSBkbyBub3Qga25vdyBob3cgdGhpc1xuICogd29ya3MuXG4gKi9cbmNsb25lLmNsb25lUHJvdG90eXBlID0gZnVuY3Rpb24gY2xvbmVQcm90b3R5cGUocGFyZW50KSB7XG4gIGlmIChwYXJlbnQgPT09IG51bGwpXG4gICAgcmV0dXJuIG51bGw7XG5cbiAgdmFyIGMgPSBmdW5jdGlvbiAoKSB7fTtcbiAgYy5wcm90b3R5cGUgPSBwYXJlbnQ7XG4gIHJldHVybiBuZXcgYygpO1xufTtcblxuLy8gcHJpdmF0ZSB1dGlsaXR5IGZ1bmN0aW9uc1xuXG5mdW5jdGlvbiBfX29ialRvU3RyKG8pIHtcbiAgcmV0dXJuIE9iamVjdC5wcm90b3R5cGUudG9TdHJpbmcuY2FsbChvKTtcbn07XG5jbG9uZS5fX29ialRvU3RyID0gX19vYmpUb1N0cjtcblxuZnVuY3Rpb24gX19pc0RhdGUobykge1xuICByZXR1cm4gdHlwZW9mIG8gPT09ICdvYmplY3QnICYmIF9fb2JqVG9TdHIobykgPT09ICdbb2JqZWN0IERhdGVdJztcbn07XG5jbG9uZS5fX2lzRGF0ZSA9IF9faXNEYXRlO1xuXG5mdW5jdGlvbiBfX2lzQXJyYXkobykge1xuICByZXR1cm4gdHlwZW9mIG8gPT09ICdvYmplY3QnICYmIF9fb2JqVG9TdHIobykgPT09ICdbb2JqZWN0IEFycmF5XSc7XG59O1xuY2xvbmUuX19pc0FycmF5ID0gX19pc0FycmF5O1xuXG5mdW5jdGlvbiBfX2lzUmVnRXhwKG8pIHtcbiAgcmV0dXJuIHR5cGVvZiBvID09PSAnb2JqZWN0JyAmJiBfX29ialRvU3RyKG8pID09PSAnW29iamVjdCBSZWdFeHBdJztcbn07XG5jbG9uZS5fX2lzUmVnRXhwID0gX19pc1JlZ0V4cDtcblxuZnVuY3Rpb24gX19nZXRSZWdFeHBGbGFncyhyZSkge1xuICB2YXIgZmxhZ3MgPSAnJztcbiAgaWYgKHJlLmdsb2JhbCkgZmxhZ3MgKz0gJ2cnO1xuICBpZiAocmUuaWdub3JlQ2FzZSkgZmxhZ3MgKz0gJ2knO1xuICBpZiAocmUubXVsdGlsaW5lKSBmbGFncyArPSAnbSc7XG4gIHJldHVybiBmbGFncztcbn07XG5jbG9uZS5fX2dldFJlZ0V4cEZsYWdzID0gX19nZXRSZWdFeHBGbGFncztcblxucmV0dXJuIGNsb25lO1xufSkoKTtcblxuaWYgKHR5cGVvZiBtb2R1bGUgPT09ICdvYmplY3QnICYmIG1vZHVsZS5leHBvcnRzKSB7XG4gIG1vZHVsZS5leHBvcnRzID0gY2xvbmU7XG59XG4iLCJ2YXIgcFNsaWNlID0gQXJyYXkucHJvdG90eXBlLnNsaWNlO1xudmFyIG9iamVjdEtleXMgPSByZXF1aXJlKCcuL2xpYi9rZXlzLmpzJyk7XG52YXIgaXNBcmd1bWVudHMgPSByZXF1aXJlKCcuL2xpYi9pc19hcmd1bWVudHMuanMnKTtcblxudmFyIGRlZXBFcXVhbCA9IG1vZHVsZS5leHBvcnRzID0gZnVuY3Rpb24gKGFjdHVhbCwgZXhwZWN0ZWQsIG9wdHMpIHtcbiAgaWYgKCFvcHRzKSBvcHRzID0ge307XG4gIC8vIDcuMS4gQWxsIGlkZW50aWNhbCB2YWx1ZXMgYXJlIGVxdWl2YWxlbnQsIGFzIGRldGVybWluZWQgYnkgPT09LlxuICBpZiAoYWN0dWFsID09PSBleHBlY3RlZCkge1xuICAgIHJldHVybiB0cnVlO1xuXG4gIH0gZWxzZSBpZiAoYWN0dWFsIGluc3RhbmNlb2YgRGF0ZSAmJiBleHBlY3RlZCBpbnN0YW5jZW9mIERhdGUpIHtcbiAgICByZXR1cm4gYWN0dWFsLmdldFRpbWUoKSA9PT0gZXhwZWN0ZWQuZ2V0VGltZSgpO1xuXG4gIC8vIDcuMy4gT3RoZXIgcGFpcnMgdGhhdCBkbyBub3QgYm90aCBwYXNzIHR5cGVvZiB2YWx1ZSA9PSAnb2JqZWN0JyxcbiAgLy8gZXF1aXZhbGVuY2UgaXMgZGV0ZXJtaW5lZCBieSA9PS5cbiAgfSBlbHNlIGlmICh0eXBlb2YgYWN0dWFsICE9ICdvYmplY3QnICYmIHR5cGVvZiBleHBlY3RlZCAhPSAnb2JqZWN0Jykge1xuICAgIHJldHVybiBvcHRzLnN0cmljdCA/IGFjdHVhbCA9PT0gZXhwZWN0ZWQgOiBhY3R1YWwgPT0gZXhwZWN0ZWQ7XG5cbiAgLy8gNy40LiBGb3IgYWxsIG90aGVyIE9iamVjdCBwYWlycywgaW5jbHVkaW5nIEFycmF5IG9iamVjdHMsIGVxdWl2YWxlbmNlIGlzXG4gIC8vIGRldGVybWluZWQgYnkgaGF2aW5nIHRoZSBzYW1lIG51bWJlciBvZiBvd25lZCBwcm9wZXJ0aWVzIChhcyB2ZXJpZmllZFxuICAvLyB3aXRoIE9iamVjdC5wcm90b3R5cGUuaGFzT3duUHJvcGVydHkuY2FsbCksIHRoZSBzYW1lIHNldCBvZiBrZXlzXG4gIC8vIChhbHRob3VnaCBub3QgbmVjZXNzYXJpbHkgdGhlIHNhbWUgb3JkZXIpLCBlcXVpdmFsZW50IHZhbHVlcyBmb3IgZXZlcnlcbiAgLy8gY29ycmVzcG9uZGluZyBrZXksIGFuZCBhbiBpZGVudGljYWwgJ3Byb3RvdHlwZScgcHJvcGVydHkuIE5vdGU6IHRoaXNcbiAgLy8gYWNjb3VudHMgZm9yIGJvdGggbmFtZWQgYW5kIGluZGV4ZWQgcHJvcGVydGllcyBvbiBBcnJheXMuXG4gIH0gZWxzZSB7XG4gICAgcmV0dXJuIG9iakVxdWl2KGFjdHVhbCwgZXhwZWN0ZWQsIG9wdHMpO1xuICB9XG59XG5cbmZ1bmN0aW9uIGlzVW5kZWZpbmVkT3JOdWxsKHZhbHVlKSB7XG4gIHJldHVybiB2YWx1ZSA9PT0gbnVsbCB8fCB2YWx1ZSA9PT0gdW5kZWZpbmVkO1xufVxuXG5mdW5jdGlvbiBpc0J1ZmZlciAoeCkge1xuICBpZiAoIXggfHwgdHlwZW9mIHggIT09ICdvYmplY3QnIHx8IHR5cGVvZiB4Lmxlbmd0aCAhPT0gJ251bWJlcicpIHJldHVybiBmYWxzZTtcbiAgaWYgKHR5cGVvZiB4LmNvcHkgIT09ICdmdW5jdGlvbicgfHwgdHlwZW9mIHguc2xpY2UgIT09ICdmdW5jdGlvbicpIHtcbiAgICByZXR1cm4gZmFsc2U7XG4gIH1cbiAgaWYgKHgubGVuZ3RoID4gMCAmJiB0eXBlb2YgeFswXSAhPT0gJ251bWJlcicpIHJldHVybiBmYWxzZTtcbiAgcmV0dXJuIHRydWU7XG59XG5cbmZ1bmN0aW9uIG9iakVxdWl2KGEsIGIsIG9wdHMpIHtcbiAgdmFyIGksIGtleTtcbiAgaWYgKGlzVW5kZWZpbmVkT3JOdWxsKGEpIHx8IGlzVW5kZWZpbmVkT3JOdWxsKGIpKVxuICAgIHJldHVybiBmYWxzZTtcbiAgLy8gYW4gaWRlbnRpY2FsICdwcm90b3R5cGUnIHByb3BlcnR5LlxuICBpZiAoYS5wcm90b3R5cGUgIT09IGIucHJvdG90eXBlKSByZXR1cm4gZmFsc2U7XG4gIC8vfn5+SSd2ZSBtYW5hZ2VkIHRvIGJyZWFrIE9iamVjdC5rZXlzIHRocm91Z2ggc2NyZXd5IGFyZ3VtZW50cyBwYXNzaW5nLlxuICAvLyAgIENvbnZlcnRpbmcgdG8gYXJyYXkgc29sdmVzIHRoZSBwcm9ibGVtLlxuICBpZiAoaXNBcmd1bWVudHMoYSkpIHtcbiAgICBpZiAoIWlzQXJndW1lbnRzKGIpKSB7XG4gICAgICByZXR1cm4gZmFsc2U7XG4gICAgfVxuICAgIGEgPSBwU2xpY2UuY2FsbChhKTtcbiAgICBiID0gcFNsaWNlLmNhbGwoYik7XG4gICAgcmV0dXJuIGRlZXBFcXVhbChhLCBiLCBvcHRzKTtcbiAgfVxuICBpZiAoaXNCdWZmZXIoYSkpIHtcbiAgICBpZiAoIWlzQnVmZmVyKGIpKSB7XG4gICAgICByZXR1cm4gZmFsc2U7XG4gICAgfVxuICAgIGlmIChhLmxlbmd0aCAhPT0gYi5sZW5ndGgpIHJldHVybiBmYWxzZTtcbiAgICBmb3IgKGkgPSAwOyBpIDwgYS5sZW5ndGg7IGkrKykge1xuICAgICAgaWYgKGFbaV0gIT09IGJbaV0pIHJldHVybiBmYWxzZTtcbiAgICB9XG4gICAgcmV0dXJuIHRydWU7XG4gIH1cbiAgdHJ5IHtcbiAgICB2YXIga2EgPSBvYmplY3RLZXlzKGEpLFxuICAgICAgICBrYiA9IG9iamVjdEtleXMoYik7XG4gIH0gY2F0Y2ggKGUpIHsvL2hhcHBlbnMgd2hlbiBvbmUgaXMgYSBzdHJpbmcgbGl0ZXJhbCBhbmQgdGhlIG90aGVyIGlzbid0XG4gICAgcmV0dXJuIGZhbHNlO1xuICB9XG4gIC8vIGhhdmluZyB0aGUgc2FtZSBudW1iZXIgb2Ygb3duZWQgcHJvcGVydGllcyAoa2V5cyBpbmNvcnBvcmF0ZXNcbiAgLy8gaGFzT3duUHJvcGVydHkpXG4gIGlmIChrYS5sZW5ndGggIT0ga2IubGVuZ3RoKVxuICAgIHJldHVybiBmYWxzZTtcbiAgLy90aGUgc2FtZSBzZXQgb2Yga2V5cyAoYWx0aG91Z2ggbm90IG5lY2Vzc2FyaWx5IHRoZSBzYW1lIG9yZGVyKSxcbiAga2Euc29ydCgpO1xuICBrYi5zb3J0KCk7XG4gIC8vfn5+Y2hlYXAga2V5IHRlc3RcbiAgZm9yIChpID0ga2EubGVuZ3RoIC0gMTsgaSA+PSAwOyBpLS0pIHtcbiAgICBpZiAoa2FbaV0gIT0ga2JbaV0pXG4gICAgICByZXR1cm4gZmFsc2U7XG4gIH1cbiAgLy9lcXVpdmFsZW50IHZhbHVlcyBmb3IgZXZlcnkgY29ycmVzcG9uZGluZyBrZXksIGFuZFxuICAvL35+fnBvc3NpYmx5IGV4cGVuc2l2ZSBkZWVwIHRlc3RcbiAgZm9yIChpID0ga2EubGVuZ3RoIC0gMTsgaSA+PSAwOyBpLS0pIHtcbiAgICBrZXkgPSBrYVtpXTtcbiAgICBpZiAoIWRlZXBFcXVhbChhW2tleV0sIGJba2V5XSwgb3B0cykpIHJldHVybiBmYWxzZTtcbiAgfVxuICByZXR1cm4gdHlwZW9mIGEgPT09IHR5cGVvZiBiO1xufVxuIiwidmFyIHN1cHBvcnRzQXJndW1lbnRzQ2xhc3MgPSAoZnVuY3Rpb24oKXtcbiAgcmV0dXJuIE9iamVjdC5wcm90b3R5cGUudG9TdHJpbmcuY2FsbChhcmd1bWVudHMpXG59KSgpID09ICdbb2JqZWN0IEFyZ3VtZW50c10nO1xuXG5leHBvcnRzID0gbW9kdWxlLmV4cG9ydHMgPSBzdXBwb3J0c0FyZ3VtZW50c0NsYXNzID8gc3VwcG9ydGVkIDogdW5zdXBwb3J0ZWQ7XG5cbmV4cG9ydHMuc3VwcG9ydGVkID0gc3VwcG9ydGVkO1xuZnVuY3Rpb24gc3VwcG9ydGVkKG9iamVjdCkge1xuICByZXR1cm4gT2JqZWN0LnByb3RvdHlwZS50b1N0cmluZy5jYWxsKG9iamVjdCkgPT0gJ1tvYmplY3QgQXJndW1lbnRzXSc7XG59O1xuXG5leHBvcnRzLnVuc3VwcG9ydGVkID0gdW5zdXBwb3J0ZWQ7XG5mdW5jdGlvbiB1bnN1cHBvcnRlZChvYmplY3Qpe1xuICByZXR1cm4gb2JqZWN0ICYmXG4gICAgdHlwZW9mIG9iamVjdCA9PSAnb2JqZWN0JyAmJlxuICAgIHR5cGVvZiBvYmplY3QubGVuZ3RoID09ICdudW1iZXInICYmXG4gICAgT2JqZWN0LnByb3RvdHlwZS5oYXNPd25Qcm9wZXJ0eS5jYWxsKG9iamVjdCwgJ2NhbGxlZScpICYmXG4gICAgIU9iamVjdC5wcm90b3R5cGUucHJvcGVydHlJc0VudW1lcmFibGUuY2FsbChvYmplY3QsICdjYWxsZWUnKSB8fFxuICAgIGZhbHNlO1xufTtcbiIsImV4cG9ydHMgPSBtb2R1bGUuZXhwb3J0cyA9IHR5cGVvZiBPYmplY3Qua2V5cyA9PT0gJ2Z1bmN0aW9uJ1xuICA/IE9iamVjdC5rZXlzIDogc2hpbTtcblxuZXhwb3J0cy5zaGltID0gc2hpbTtcbmZ1bmN0aW9uIHNoaW0gKG9iaikge1xuICB2YXIga2V5cyA9IFtdO1xuICBmb3IgKHZhciBrZXkgaW4gb2JqKSBrZXlzLnB1c2goa2V5KTtcbiAgcmV0dXJuIGtleXM7XG59XG4iLCJ2YXIgRW50aSA9IHJlcXVpcmUoJ2VudGknKSxcbiAgICBXaGF0Q2hhbmdlZCA9IHJlcXVpcmUoJ3doYXQtY2hhbmdlZCcpLFxuICAgIHNhbWUgPSByZXF1aXJlKCdzYW1lLXZhbHVlJyksXG4gICAgZmlybWVyID0gcmVxdWlyZSgnLi9maXJtZXInKSxcbiAgICBjcmVhdGVCaW5kaW5nID0gcmVxdWlyZSgnLi9iaW5kaW5nJyksXG4gICAgZnVuY3Rpb25FbWl0dGVyID0gcmVxdWlyZSgnLi9mdW5jdGlvbkVtaXR0ZXInKSxcbiAgICBzZXRQcm90b3R5cGVPZiA9IHJlcXVpcmUoJ3NldHByb3RvdHlwZW9mJyksXG4gICAgaXMgPSByZXF1aXJlKCcuL2lzJyk7XG5cbnZhciBwcm9wZXJ0eVByb3RvID0gT2JqZWN0LmNyZWF0ZShmdW5jdGlvbkVtaXR0ZXIpO1xuXG5wcm9wZXJ0eVByb3RvLl9mYXN0bl9wcm9wZXJ0eSA9IHRydWU7XG5wcm9wZXJ0eVByb3RvLl9maXJtID0gMTtcblxuZnVuY3Rpb24gcHJvcGVydHlUZW1wbGF0ZSh2YWx1ZSl7XG4gICAgaWYoIWFyZ3VtZW50cy5sZW5ndGgpe1xuICAgICAgICByZXR1cm4gdGhpcy5iaW5kaW5nICYmIHRoaXMuYmluZGluZygpIHx8IHRoaXMucHJvcGVydHkuX3ZhbHVlO1xuICAgIH1cblxuICAgIGlmKCF0aGlzLmRlc3Ryb3llZCl7XG4gICAgICAgIGlmKHRoaXMuYmluZGluZyl7XG4gICAgICAgICAgICB0aGlzLmJpbmRpbmcodmFsdWUpO1xuICAgICAgICAgICAgcmV0dXJuIHRoaXMucHJvcGVydHk7XG4gICAgICAgIH1cblxuICAgICAgICB0aGlzLnZhbHVlVXBkYXRlKHZhbHVlKTtcbiAgICB9XG5cbiAgICByZXR1cm4gdGhpcy5wcm9wZXJ0eTtcbn1cblxuZnVuY3Rpb24gY2hhbmdlQ2hlY2tlcihjdXJyZW50LCBjaGFuZ2VzKXtcbiAgICBpZihjaGFuZ2VzKXtcbiAgICAgICAgdmFyIGNoYW5nZXMgPSBuZXcgV2hhdENoYW5nZWQoY3VycmVudCwgY2hhbmdlcyk7XG5cbiAgICAgICAgcmV0dXJuIGZ1bmN0aW9uKHZhbHVlKXtcbiAgICAgICAgICAgIHJldHVybiBPYmplY3Qua2V5cyhjaGFuZ2VzLnVwZGF0ZSh2YWx1ZSkpLmxlbmd0aCA+IDA7XG4gICAgICAgIH07XG4gICAgfWVsc2V7XG4gICAgICAgIHZhciBsYXN0VmFsdWUgPSBjdXJyZW50O1xuICAgICAgICByZXR1cm4gZnVuY3Rpb24obmV3VmFsdWUpe1xuICAgICAgICAgICAgaWYoIXNhbWUobGFzdFZhbHVlLCBuZXdWYWx1ZSkpe1xuICAgICAgICAgICAgICAgIGxhc3RWYWx1ZSA9IG5ld1ZhbHVlO1xuICAgICAgICAgICAgICAgIHJldHVybiB0cnVlO1xuICAgICAgICAgICAgfVxuICAgICAgICB9O1xuICAgIH1cbn1cblxuXG5mdW5jdGlvbiBwcm9wZXJ0eUJpbmRpbmcobmV3QmluZGluZyl7XG4gICAgaWYoIWFyZ3VtZW50cy5sZW5ndGgpe1xuICAgICAgICByZXR1cm4gdGhpcy5iaW5kaW5nO1xuICAgIH1cblxuICAgIGlmKCFpcy5iaW5kaW5nKG5ld0JpbmRpbmcpKXtcbiAgICAgICAgbmV3QmluZGluZyA9IGNyZWF0ZUJpbmRpbmcobmV3QmluZGluZyk7XG4gICAgfVxuXG4gICAgaWYobmV3QmluZGluZyA9PT0gdGhpcy5iaW5kaW5nKXtcbiAgICAgICAgcmV0dXJuIHRoaXMucHJvcGVydHk7XG4gICAgfVxuXG4gICAgaWYodGhpcy5iaW5kaW5nKXtcbiAgICAgICAgdGhpcy5iaW5kaW5nLnJlbW92ZUxpc3RlbmVyKCdjaGFuZ2UnLCB0aGlzLnZhbHVlVXBkYXRlKTtcbiAgICB9XG5cbiAgICB0aGlzLmJpbmRpbmcgPSBuZXdCaW5kaW5nO1xuXG4gICAgaWYodGhpcy5tb2RlbCl7XG4gICAgICAgIHRoaXMucHJvcGVydHkuYXR0YWNoKHRoaXMubW9kZWwsIHRoaXMucHJvcGVydHkuX2Zpcm0pO1xuICAgIH1cblxuICAgIHRoaXMuYmluZGluZy5vbignY2hhbmdlJywgdGhpcy52YWx1ZVVwZGF0ZSk7XG4gICAgdGhpcy52YWx1ZVVwZGF0ZSh0aGlzLmJpbmRpbmcoKSk7XG5cbiAgICByZXR1cm4gdGhpcy5wcm9wZXJ0eTtcbn07XG5cbmZ1bmN0aW9uIGF0dGFjaFByb3BlcnR5KG9iamVjdCwgZmlybSl7XG4gICAgaWYoZmlybWVyKHRoaXMucHJvcGVydHksIGZpcm0pKXtcbiAgICAgICAgcmV0dXJuIHRoaXMucHJvcGVydHk7XG4gICAgfVxuXG4gICAgdGhpcy5wcm9wZXJ0eS5fZmlybSA9IGZpcm07XG5cbiAgICBpZighKG9iamVjdCBpbnN0YW5jZW9mIE9iamVjdCkpe1xuICAgICAgICBvYmplY3QgPSB7fTtcbiAgICB9XG5cbiAgICBpZih0aGlzLmJpbmRpbmcpe1xuICAgICAgICB0aGlzLm1vZGVsID0gb2JqZWN0O1xuICAgICAgICB0aGlzLmJpbmRpbmcuYXR0YWNoKG9iamVjdCwgMSk7XG4gICAgfVxuXG4gICAgaWYodGhpcy5wcm9wZXJ0eS5fZXZlbnRzICYmICdhdHRhY2gnIGluIHRoaXMucHJvcGVydHkuX2V2ZW50cyl7XG4gICAgICAgIHRoaXMucHJvcGVydHkuZW1pdCgnYXR0YWNoJywgb2JqZWN0LCAxKTtcbiAgICB9XG5cbiAgICByZXR1cm4gdGhpcy5wcm9wZXJ0eTtcbn07XG5cbmZ1bmN0aW9uIGRldGFjaFByb3BlcnR5KGZpcm0pe1xuICAgIGlmKGZpcm1lcih0aGlzLnByb3BlcnR5LCBmaXJtKSl7XG4gICAgICAgIHJldHVybiB0aGlzLnByb3BlcnR5O1xuICAgIH1cblxuICAgIGlmKHRoaXMuYmluZGluZyl7XG4gICAgICAgIHRoaXMuYmluZGluZy5yZW1vdmVMaXN0ZW5lcignY2hhbmdlJywgdGhpcy52YWx1ZVVwZGF0ZSk7XG4gICAgICAgIHRoaXMuYmluZGluZy5kZXRhY2goMSk7XG4gICAgICAgIHRoaXMubW9kZWwgPSBudWxsO1xuICAgIH1cblxuICAgIGlmKHRoaXMucHJvcGVydHkuX2V2ZW50cyAmJiAnZGV0YWNoJyBpbiB0aGlzLnByb3BlcnR5Ll9ldmVudHMpe1xuICAgICAgICB0aGlzLnByb3BlcnR5LmVtaXQoJ2RldGFjaCcsIDEpO1xuICAgIH1cblxuICAgIHJldHVybiB0aGlzLnByb3BlcnR5O1xufTtcblxuZnVuY3Rpb24gdXBkYXRlUHJvcGVydHkoKXtcbiAgICBpZighdGhpcy5kZXN0cm95ZWQpe1xuXG4gICAgICAgIGlmKHRoaXMucHJvcGVydHkuX3VwZGF0ZSl7XG4gICAgICAgICAgICB0aGlzLnByb3BlcnR5Ll91cGRhdGUodGhpcy5wcm9wZXJ0eS5fdmFsdWUsIHRoaXMucHJvcGVydHkpO1xuICAgICAgICB9XG5cbiAgICAgICAgdGhpcy5wcm9wZXJ0eS5lbWl0KCd1cGRhdGUnLCB0aGlzLnByb3BlcnR5Ll92YWx1ZSk7XG4gICAgfVxuICAgIHJldHVybiB0aGlzLnByb3BlcnR5O1xufTtcblxuZnVuY3Rpb24gcHJvcGVydHlVcGRhdGVyKGZuKXtcbiAgICBpZighYXJndW1lbnRzLmxlbmd0aCl7XG4gICAgICAgIHJldHVybiB0aGlzLnByb3BlcnR5Ll91cGRhdGU7XG4gICAgfVxuICAgIHRoaXMucHJvcGVydHkuX3VwZGF0ZSA9IGZuO1xuICAgIHJldHVybiB0aGlzLnByb3BlcnR5O1xufTtcblxuZnVuY3Rpb24gZGVzdHJveVByb3BlcnR5KCl7XG4gICAgaWYoIXRoaXMuZGVzdHJveWVkKXtcbiAgICAgICAgdGhpcy5kZXN0cm95ZWQgPSB0cnVlO1xuXG4gICAgICAgIHRoaXMucHJvcGVydHlcbiAgICAgICAgICAgIC5yZW1vdmVBbGxMaXN0ZW5lcnMoJ2NoYW5nZScpXG4gICAgICAgICAgICAucmVtb3ZlQWxsTGlzdGVuZXJzKCd1cGRhdGUnKVxuICAgICAgICAgICAgLnJlbW92ZUFsbExpc3RlbmVycygnYXR0YWNoJyk7XG5cbiAgICAgICAgdGhpcy5wcm9wZXJ0eS5lbWl0KCdkZXN0cm95Jyk7XG4gICAgICAgIHRoaXMucHJvcGVydHkuZGV0YWNoKCk7XG4gICAgICAgIGlmKHRoaXMuYmluZGluZyl7XG4gICAgICAgICAgICB0aGlzLmJpbmRpbmcuZGVzdHJveSh0cnVlKTtcbiAgICAgICAgfVxuICAgIH1cbiAgICByZXR1cm4gdGhpcy5wcm9wZXJ0eTtcbn07XG5cbmZ1bmN0aW9uIHByb3BlcnR5RGVzdHJveWVkKCl7XG4gICAgcmV0dXJuIHRoaXMuZGVzdHJveWVkO1xufTtcblxuZnVuY3Rpb24gYWRkUHJvcGVydHlUbyhjb21wb25lbnQsIGtleSl7XG4gICAgY29tcG9uZW50LnNldFByb3BlcnR5KGtleSwgdGhpcy5wcm9wZXJ0eSk7XG5cbiAgICByZXR1cm4gdGhpcy5wcm9wZXJ0eTtcbn07XG5cbmZ1bmN0aW9uIGNyZWF0ZVByb3BlcnR5KGN1cnJlbnRWYWx1ZSwgY2hhbmdlcywgdXBkYXRlcil7XG4gICAgaWYodHlwZW9mIGNoYW5nZXMgPT09ICdmdW5jdGlvbicpe1xuICAgICAgICB1cGRhdGVyID0gY2hhbmdlcztcbiAgICAgICAgY2hhbmdlcyA9IG51bGw7XG4gICAgfVxuXG4gICAgdmFyIHByb3BlcnR5U2NvcGUgPVxuICAgICAgICBwcm9wZXJ0eSA9IHByb3BlcnR5VGVtcGxhdGUuYmluZChwcm9wZXJ0eVNjb3BlKVxuICAgICAgICBwcm9wZXJ0eVNjb3BlID0ge1xuICAgICAgICBoYXNDaGFuZ2VkOiBjaGFuZ2VDaGVja2VyKGN1cnJlbnRWYWx1ZSwgY2hhbmdlcyksXG4gICAgICAgIHZhbHVlVXBkYXRlOiBmdW5jdGlvbih2YWx1ZSl7XG4gICAgICAgICAgICBwcm9wZXJ0eS5fdmFsdWUgPSB2YWx1ZTtcbiAgICAgICAgICAgIGlmKCFwcm9wZXJ0eVNjb3BlLmhhc0NoYW5nZWQodmFsdWUpKXtcbiAgICAgICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBwcm9wZXJ0eS5lbWl0KCdjaGFuZ2UnLCBwcm9wZXJ0eS5fdmFsdWUpO1xuICAgICAgICAgICAgcHJvcGVydHkudXBkYXRlKCk7XG4gICAgICAgIH1cbiAgICB9O1xuXG4gICAgdmFyIHByb3BlcnR5ID0gcHJvcGVydHlTY29wZS5wcm9wZXJ0eSA9IHByb3BlcnR5VGVtcGxhdGUuYmluZChwcm9wZXJ0eVNjb3BlKTtcblxuICAgIHByb3BlcnR5Ll92YWx1ZSA9IGN1cnJlbnRWYWx1ZTtcbiAgICBwcm9wZXJ0eS5fdXBkYXRlID0gdXBkYXRlcjtcblxuICAgIHNldFByb3RvdHlwZU9mKHByb3BlcnR5LCBwcm9wZXJ0eVByb3RvKTtcblxuICAgIHByb3BlcnR5LmJpbmRpbmcgPSBwcm9wZXJ0eUJpbmRpbmcuYmluZChwcm9wZXJ0eVNjb3BlKTtcbiAgICBwcm9wZXJ0eS5hdHRhY2ggPSBhdHRhY2hQcm9wZXJ0eS5iaW5kKHByb3BlcnR5U2NvcGUpO1xuICAgIHByb3BlcnR5LmRldGFjaCA9IGRldGFjaFByb3BlcnR5LmJpbmQocHJvcGVydHlTY29wZSk7XG4gICAgcHJvcGVydHkudXBkYXRlID0gdXBkYXRlUHJvcGVydHkuYmluZChwcm9wZXJ0eVNjb3BlKTtcbiAgICBwcm9wZXJ0eS51cGRhdGVyID0gcHJvcGVydHlVcGRhdGVyLmJpbmQocHJvcGVydHlTY29wZSk7XG4gICAgcHJvcGVydHkuZGVzdHJveSA9IGRlc3Ryb3lQcm9wZXJ0eS5iaW5kKHByb3BlcnR5U2NvcGUpO1xuICAgIHByb3BlcnR5LmRlc3Ryb3llZCA9IHByb3BlcnR5RGVzdHJveWVkLmJpbmQocHJvcGVydHlTY29wZSk7XG4gICAgcHJvcGVydHkuYWRkVG8gPSBhZGRQcm9wZXJ0eVRvLmJpbmQocHJvcGVydHlTY29wZSk7XG5cbiAgICByZXR1cm4gcHJvcGVydHk7XG59O1xuXG5tb2R1bGUuZXhwb3J0cyA9IGNyZWF0ZVByb3BlcnR5OyIsInZhciB0b2RvID0gW10sXG4gICAgdG9kb0tleXMgPSBbXSxcbiAgICBzY2hlZHVsZWQsXG4gICAgdXBkYXRlcyA9IDA7XG5cbmZ1bmN0aW9uIHJ1bigpe1xuICAgIHZhciBzdGFydFRpbWUgPSBEYXRlLm5vdygpO1xuXG4gICAgd2hpbGUodG9kby5sZW5ndGggJiYgRGF0ZS5ub3coKSAtIHN0YXJ0VGltZSA8IDE2KXtcbiAgICAgICAgdG9kb0tleXMuc2hpZnQoKTtcbiAgICAgICAgdG9kby5zaGlmdCgpKCk7XG4gICAgfVxuXG4gICAgaWYodG9kby5sZW5ndGgpe1xuICAgICAgICByZXF1ZXN0QW5pbWF0aW9uRnJhbWUocnVuKTtcbiAgICB9ZWxzZXtcbiAgICAgICAgc2NoZWR1bGVkID0gZmFsc2U7XG4gICAgfVxufVxuXG5mdW5jdGlvbiBzY2hlZHVsZShrZXksIGZuKXtcbiAgICBpZih+dG9kb0tleXMuaW5kZXhPZihrZXkpKXtcbiAgICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIHRvZG8ucHVzaChmbik7XG4gICAgdG9kb0tleXMucHVzaChrZXkpO1xuXG4gICAgaWYoIXNjaGVkdWxlZCl7XG4gICAgICAgIHNjaGVkdWxlZCA9IHRydWU7XG4gICAgICAgIHJlcXVlc3RBbmltYXRpb25GcmFtZShydW4pO1xuICAgIH1cbn1cblxubW9kdWxlLmV4cG9ydHMgPSBzY2hlZHVsZTsiLCJmdW5jdGlvbiB1cGRhdGVUZXh0KCl7XG4gICAgaWYoIXRoaXMuZWxlbWVudCl7XG4gICAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICB2YXIgdmFsdWUgPSB0aGlzLnRleHQoKTtcblxuICAgIHRoaXMuZWxlbWVudC50ZXh0Q29udGVudCA9ICh2YWx1ZSA9PSBudWxsID8gJycgOiB2YWx1ZSk7XG59XG5cbmZ1bmN0aW9uIGF1dG9SZW5kZXIoY29udGVudCl7XG4gICAgdGhpcy5lbGVtZW50ID0gZG9jdW1lbnQuY3JlYXRlVGV4dE5vZGUoY29udGVudCk7XG59XG5cbmZ1bmN0aW9uIGF1dG9UZXh0KHRleHQsIGZhc3RuLCBjb250ZW50KSB7XG4gICAgdGV4dC5yZW5kZXIgPSBhdXRvUmVuZGVyLmJpbmQodGV4dCwgY29udGVudCk7XG5cbiAgICByZXR1cm4gdGV4dDtcbn1cblxuZnVuY3Rpb24gcmVuZGVyKCl7XG4gICAgdGhpcy5lbGVtZW50ID0gdGhpcy5jcmVhdGVUZXh0Tm9kZSh0aGlzLnRleHQoKSk7XG4gICAgdGhpcy5lbWl0KCdyZW5kZXInKTtcbn07XG5cbmZ1bmN0aW9uIHRleHRDb21wb25lbnQoZmFzdG4sIGNvbXBvbmVudCwgdHlwZSwgc2V0dGluZ3MsIGNoaWxkcmVuKXtcbiAgICBpZihzZXR0aW5ncy5hdXRvKXtcbiAgICAgICAgZGVsZXRlIHNldHRpbmdzLmF1dG87XG4gICAgICAgIGlmKCFmYXN0bi5pc0JpbmRpbmcoY2hpbGRyZW5bMF0pKXtcbiAgICAgICAgICAgIHJldHVybiBhdXRvVGV4dChjb21wb25lbnQsIGZhc3RuLCBjaGlsZHJlblswXSk7XG4gICAgICAgIH1cbiAgICAgICAgc2V0dGluZ3MudGV4dCA9IGNoaWxkcmVuLnBvcCgpO1xuICAgIH1cblxuICAgIGNvbXBvbmVudC5jcmVhdGVUZXh0Tm9kZSA9IHRleHRDb21wb25lbnQuY3JlYXRlVGV4dE5vZGU7XG4gICAgY29tcG9uZW50LnJlbmRlciA9IHJlbmRlci5iaW5kKGNvbXBvbmVudCk7XG5cbiAgICBjb21wb25lbnQuc2V0UHJvcGVydHkoJ3RleHQnLCBmYXN0bi5wcm9wZXJ0eSgnJywgdXBkYXRlVGV4dC5iaW5kKGNvbXBvbmVudCkpKTtcblxuICAgIHJldHVybiBjb21wb25lbnQ7XG59XG5cbnRleHRDb21wb25lbnQuY3JlYXRlVGV4dE5vZGUgPSBmdW5jdGlvbih0ZXh0KXtcbiAgICByZXR1cm4gZG9jdW1lbnQuY3JlYXRlVGV4dE5vZGUodGV4dCk7XG59O1xuXG5tb2R1bGUuZXhwb3J0cyA9IHRleHRDb21wb25lbnQ7IiwidmFyIGRvYyA9IHJlcXVpcmUoJ2RvYy1qcycpLFxuICAgIHNldGlmeSA9IHJlcXVpcmUoJ3NldGlmeScpLFxuICAgIG5hdHVyYWxTZWxlY3Rpb24gPSByZXF1aXJlKCduYXR1cmFsLXNlbGVjdGlvbicpO1xuXG5mdW5jdGlvbiBjb25zdHJ1Y3RJbnNlcnRTdHJpbmcoZWxlbWVudCwgaW5zZXJ0VmFsdWUpe1xuICAgIHZhciByZXN1bHQgPSAnJyxcbiAgICAgICAgdmFsdWUgPSBlbGVtZW50LnZhbHVlO1xuXG4gICAgaWYobmF0dXJhbFNlbGVjdGlvbihlbGVtZW50KSkge1xuICAgICAgICB2YXIgc3RhcnQgPSBlbGVtZW50LnNlbGVjdGlvblN0YXJ0LFxuICAgICAgICAgICAgZW5kID0gZWxlbWVudC5zZWxlY3Rpb25FbmQ7XG5cbiAgICAgICAgcmVzdWx0ID0gdmFsdWUuc2xpY2UoMCwgc3RhcnQpICsgaW5zZXJ0VmFsdWUgKyB2YWx1ZS5zbGljZShlbmQpO1xuICAgIH0gZWxzZSB7XG4gICAgICAgIHJlc3VsdCA9IHZhbHVlICsgaW5zZXJ0VmFsdWU7XG4gICAgfVxuXG4gICAgcmV0dXJuIHJlc3VsdDtcbn1cblxuZnVuY3Rpb24gdmFsaWRhdGVJbnB1dCh0ZXN0U3RyaW5nLCByZWdleCkge1xuICAgIHZhciBuZXdSZWdleCA9IG5ldyBSZWdFeHAocmVnZXgpO1xuXG4gICAgcmV0dXJuICEhdGVzdFN0cmluZy5tYXRjaChuZXdSZWdleCk7XG59XG5cbmZ1bmN0aW9uIHZhbGlkYXRlS2V5KGV2ZW50LCByZWdleCkge1xuICAgIHZhciBuZXdDaGFyID0gU3RyaW5nLmZyb21DaGFyQ29kZShldmVudC53aGljaCksXG4gICAgICAgIHRlc3RTdHJpbmcgPSBjb25zdHJ1Y3RJbnNlcnRTdHJpbmcoZXZlbnQudGFyZ2V0LCBuZXdDaGFyKTtcblxuICAgIGlmKCF2YWxpZGF0ZUlucHV0KHRlc3RTdHJpbmcsIHJlZ2V4KSl7XG4gICAgICAgIGV2ZW50LnByZXZlbnREZWZhdWx0KCk7XG4gICAgfVxufVxuXG5mdW5jdGlvbiB2YWxpZGF0ZVBhc3RlKGV2ZW50LCByZWdleCl7XG4gICAgZXZlbnQucHJldmVudERlZmF1bHQoKTtcblxuICAgIHZhciBlbGVtZW50ID0gZXZlbnQudGFyZ2V0LFxuICAgICAgICBwYXN0ZWREYXRhID0gZXZlbnQuY2xpcGJvYXJkRGF0YS5nZXREYXRhKCdUZXh0JyksXG4gICAgICAgIG1heExlbmd0aCA9IGVsZW1lbnQubWF4TGVuZ3RoO1xuXG4gICAgcGFzdGVkRGF0YSA9IGNvbnN0cnVjdEluc2VydFN0cmluZyhlbGVtZW50LCBwYXN0ZWREYXRhKTtcbiAgICBwYXN0ZWREYXRhID0gcGFzdGVkRGF0YS5zcGxpdCgnJylcbiAgICAgICAgLnJlZHVjZShmdW5jdGlvbihyZXN1bHQsIGNoYXJhdGVyKSB7XG4gICAgICAgICAgICBpZih2YWxpZGF0ZUlucHV0KHJlc3VsdCArIGNoYXJhdGVyLCByZWdleCkpe1xuICAgICAgICAgICAgICAgIHJldHVybiByZXN1bHQgKyBjaGFyYXRlcjtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgcmV0dXJuIHJlc3VsdDtcbiAgICAgICAgfSwgJycpO1xuXG4gICAgc2V0aWZ5KGVsZW1lbnQsIHBhc3RlZERhdGEpO1xufVxuXG52YXIgZXZlbnRWYWxpZGF0b3JzID0ge1xuICAgICdwYXN0ZSc6IHZhbGlkYXRlUGFzdGUsXG4gICAgJ2tleXByZXNzJzogdmFsaWRhdGVLZXlcbn07XG5cbnZhciBkZWZhdWx0VmFsaWRhdG9ycyA9ICB7XG4gICAgJ1t0eXBlPWVtYWlsXSc6IC9eW15AXSokfF5bXkBdK0BbXkBdKiQvLFxuICAgICdbdHlwZT1udW1iZXJdJzogL15cXGQqJHxeXFxkKlxcLiR8XlxcZCpcXC5cXGQrJC9cbn07XG5cbmZ1bmN0aW9uIHBhcnNlUmVnZXgocmVnZXhTdHJpbmcpe1xuICAgIHZhciByZWdleFBhcnRzID0gcmVnZXhTdHJpbmcubWF0Y2goL15cXC8oLiopXFwvKC4qKSQvKTtcblxuICAgIHJldHVybiByZWdleFBhcnRzICYmIG5ldyBSZWdFeHAocmVnZXhQYXJ0c1sxXSwgcmVnZXhQYXJ0c1syXSk7XG59XG5cbm1vZHVsZS5leHBvcnRzID0gZnVuY3Rpb24oc2V0dGluZ3MpIHtcbiAgICB2YXIgcGFyZW50RWxlbWVudCA9IHNldHRpbmdzLnBhcmVudEVsZW1lbnQgfHwgZG9jdW1lbnQsXG4gICAgICAgIHZhbGlkYXRvcnMgPSBzZXR0aW5ncy52YWxpZGF0b3JzIHx8IG1vZHVsZS5leHBvcnRzLmRlZmF1bHRWYWxpZGF0b3JzKCksXG4gICAgICAgIHNlbGVjdG9ycyA9IE9iamVjdC5rZXlzKHZhbGlkYXRvcnMpLmpvaW4oJywgJyk7XG5cbiAgICBmdW5jdGlvbiBnZXRWYWxpZGF0b3JLZXkodmFsaWRhdG9yS2V5KSB7XG4gICAgICAgIGlmKGRvYy5pcyhldmVudC50YXJnZXQsIHZhbGlkYXRvcktleSkpIHtcbiAgICAgICAgICAgIHJldHVybiB2YWxpZGF0b3JLZXk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBmdW5jdGlvbiB2YWxpZGF0ZUlucHV0KGV2ZW50KSB7XG4gICAgICAgIHZhciB2YWxpZGF0b3JLZXkgPSBPYmplY3Qua2V5cyh2YWxpZGF0b3JzKS5maW5kKGdldFZhbGlkYXRvcktleSk7XG5cbiAgICAgICAgdmFyIHZhbGlkYXRvciA9IGV2ZW50VmFsaWRhdG9yc1tldmVudC50eXBlXSxcbiAgICAgICAgICAgIHJlZ2V4ID0gdmFsaWRhdG9yc1t2YWxpZGF0b3JLZXldO1xuXG4gICAgICAgIGlmKCF2YWxpZGF0b3IgfHwgIXJlZ2V4KSB7XG4gICAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cblxuICAgICAgICB2YWxpZGF0b3IoZXZlbnQsIHJlZ2V4KTtcbiAgICB9XG5cbiAgICBkb2MocGFyZW50RWxlbWVudCkub24oJ3Bhc3RlIGtleXByZXNzJywgc2VsZWN0b3JzLCB2YWxpZGF0ZUlucHV0KTtcbn07XG5cbm1vZHVsZS5leHBvcnRzLmRlZmF1bHRWYWxpZGF0b3JzID0gZnVuY3Rpb24oKSB7XG4gICAgcmV0dXJuIE9iamVjdC5jcmVhdGUoZGVmYXVsdFZhbGlkYXRvcnMpO1xufTtcbiIsInZhciBkZWZpbmVkID0gcmVxdWlyZSgnZGVmaW5lZCcpO1xudmFyIGNyZWF0ZURlZmF1bHRTdHJlYW0gPSByZXF1aXJlKCcuL2xpYi9kZWZhdWx0X3N0cmVhbScpO1xudmFyIFRlc3QgPSByZXF1aXJlKCcuL2xpYi90ZXN0Jyk7XG52YXIgY3JlYXRlUmVzdWx0ID0gcmVxdWlyZSgnLi9saWIvcmVzdWx0cycpO1xudmFyIHRocm91Z2ggPSByZXF1aXJlKCd0aHJvdWdoJyk7XG5cbnZhciBjYW5FbWl0RXhpdCA9IHR5cGVvZiBwcm9jZXNzICE9PSAndW5kZWZpbmVkJyAmJiBwcm9jZXNzXG4gICAgJiYgdHlwZW9mIHByb2Nlc3Mub24gPT09ICdmdW5jdGlvbicgJiYgcHJvY2Vzcy5icm93c2VyICE9PSB0cnVlXG47XG52YXIgY2FuRXhpdCA9IHR5cGVvZiBwcm9jZXNzICE9PSAndW5kZWZpbmVkJyAmJiBwcm9jZXNzXG4gICAgJiYgdHlwZW9mIHByb2Nlc3MuZXhpdCA9PT0gJ2Z1bmN0aW9uJ1xuO1xuXG52YXIgbmV4dFRpY2sgPSB0eXBlb2Ygc2V0SW1tZWRpYXRlICE9PSAndW5kZWZpbmVkJ1xuICAgID8gc2V0SW1tZWRpYXRlXG4gICAgOiBwcm9jZXNzLm5leHRUaWNrXG47XG5cbmV4cG9ydHMgPSBtb2R1bGUuZXhwb3J0cyA9IChmdW5jdGlvbiAoKSB7XG4gICAgdmFyIGhhcm5lc3M7XG4gICAgdmFyIGxhenlMb2FkID0gZnVuY3Rpb24gKCkge1xuICAgICAgICByZXR1cm4gZ2V0SGFybmVzcygpLmFwcGx5KHRoaXMsIGFyZ3VtZW50cyk7XG4gICAgfTtcbiAgICBcbiAgICBsYXp5TG9hZC5vbmx5ID0gZnVuY3Rpb24gKCkge1xuICAgICAgICByZXR1cm4gZ2V0SGFybmVzcygpLm9ubHkuYXBwbHkodGhpcywgYXJndW1lbnRzKTtcbiAgICB9O1xuICAgIFxuICAgIGxhenlMb2FkLmNyZWF0ZVN0cmVhbSA9IGZ1bmN0aW9uIChvcHRzKSB7XG4gICAgICAgIGlmICghb3B0cykgb3B0cyA9IHt9O1xuICAgICAgICBpZiAoIWhhcm5lc3MpIHtcbiAgICAgICAgICAgIHZhciBvdXRwdXQgPSB0aHJvdWdoKCk7XG4gICAgICAgICAgICBnZXRIYXJuZXNzKHsgc3RyZWFtOiBvdXRwdXQsIG9iamVjdE1vZGU6IG9wdHMub2JqZWN0TW9kZSB9KTtcbiAgICAgICAgICAgIHJldHVybiBvdXRwdXQ7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIGhhcm5lc3MuY3JlYXRlU3RyZWFtKG9wdHMpO1xuICAgIH07XG4gICAgXG4gICAgbGF6eUxvYWQub25GaW5pc2ggPSBmdW5jdGlvbiAoKSB7XG4gICAgICAgIHJldHVybiBnZXRIYXJuZXNzKCkub25GaW5pc2guYXBwbHkodGhpcywgYXJndW1lbnRzKTtcbiAgICB9O1xuXG4gICAgbGF6eUxvYWQuZ2V0SGFybmVzcyA9IGdldEhhcm5lc3NcblxuICAgIHJldHVybiBsYXp5TG9hZFxuXG4gICAgZnVuY3Rpb24gZ2V0SGFybmVzcyAob3B0cykge1xuICAgICAgICBpZiAoIW9wdHMpIG9wdHMgPSB7fTtcbiAgICAgICAgb3B0cy5hdXRvY2xvc2UgPSAhY2FuRW1pdEV4aXQ7XG4gICAgICAgIGlmICghaGFybmVzcykgaGFybmVzcyA9IGNyZWF0ZUV4aXRIYXJuZXNzKG9wdHMpO1xuICAgICAgICByZXR1cm4gaGFybmVzcztcbiAgICB9XG59KSgpO1xuXG5mdW5jdGlvbiBjcmVhdGVFeGl0SGFybmVzcyAoY29uZikge1xuICAgIGlmICghY29uZikgY29uZiA9IHt9O1xuICAgIHZhciBoYXJuZXNzID0gY3JlYXRlSGFybmVzcyh7XG4gICAgICAgIGF1dG9jbG9zZTogZGVmaW5lZChjb25mLmF1dG9jbG9zZSwgZmFsc2UpXG4gICAgfSk7XG4gICAgXG4gICAgdmFyIHN0cmVhbSA9IGhhcm5lc3MuY3JlYXRlU3RyZWFtKHsgb2JqZWN0TW9kZTogY29uZi5vYmplY3RNb2RlIH0pO1xuICAgIHZhciBlcyA9IHN0cmVhbS5waXBlKGNvbmYuc3RyZWFtIHx8IGNyZWF0ZURlZmF1bHRTdHJlYW0oKSk7XG4gICAgaWYgKGNhbkVtaXRFeGl0KSB7XG4gICAgICAgIGVzLm9uKCdlcnJvcicsIGZ1bmN0aW9uIChlcnIpIHsgaGFybmVzcy5fZXhpdENvZGUgPSAxIH0pO1xuICAgIH1cbiAgICBcbiAgICB2YXIgZW5kZWQgPSBmYWxzZTtcbiAgICBzdHJlYW0ub24oJ2VuZCcsIGZ1bmN0aW9uICgpIHsgZW5kZWQgPSB0cnVlIH0pO1xuICAgIFxuICAgIGlmIChjb25mLmV4aXQgPT09IGZhbHNlKSByZXR1cm4gaGFybmVzcztcbiAgICBpZiAoIWNhbkVtaXRFeGl0IHx8ICFjYW5FeGl0KSByZXR1cm4gaGFybmVzcztcblxuICAgIHZhciBpbkVycm9yU3RhdGUgPSBmYWxzZTtcblxuICAgIHByb2Nlc3Mub24oJ2V4aXQnLCBmdW5jdGlvbiAoY29kZSkge1xuICAgICAgICAvLyBsZXQgdGhlIHByb2Nlc3MgZXhpdCBjbGVhbmx5LlxuICAgICAgICBpZiAoY29kZSAhPT0gMCkge1xuICAgICAgICAgICAgcmV0dXJuXG4gICAgICAgIH1cblxuICAgICAgICBpZiAoIWVuZGVkKSB7XG4gICAgICAgICAgICB2YXIgb25seSA9IGhhcm5lc3MuX3Jlc3VsdHMuX29ubHk7XG4gICAgICAgICAgICBmb3IgKHZhciBpID0gMDsgaSA8IGhhcm5lc3MuX3Rlc3RzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICAgICAgdmFyIHQgPSBoYXJuZXNzLl90ZXN0c1tpXTtcbiAgICAgICAgICAgICAgICBpZiAob25seSAmJiB0Lm5hbWUgIT09IG9ubHkpIGNvbnRpbnVlO1xuICAgICAgICAgICAgICAgIHQuX2V4aXQoKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICBoYXJuZXNzLmNsb3NlKCk7XG4gICAgICAgIHByb2Nlc3MuZXhpdChjb2RlIHx8IGhhcm5lc3MuX2V4aXRDb2RlKTtcbiAgICB9KTtcbiAgICBcbiAgICByZXR1cm4gaGFybmVzcztcbn1cblxuZXhwb3J0cy5jcmVhdGVIYXJuZXNzID0gY3JlYXRlSGFybmVzcztcbmV4cG9ydHMuVGVzdCA9IFRlc3Q7XG5leHBvcnRzLnRlc3QgPSBleHBvcnRzOyAvLyB0YXAgY29tcGF0XG5leHBvcnRzLnRlc3Quc2tpcCA9IFRlc3Quc2tpcDtcblxudmFyIGV4aXRJbnRlcnZhbDtcblxuZnVuY3Rpb24gY3JlYXRlSGFybmVzcyAoY29uZl8pIHtcbiAgICBpZiAoIWNvbmZfKSBjb25mXyA9IHt9O1xuICAgIHZhciByZXN1bHRzID0gY3JlYXRlUmVzdWx0KCk7XG4gICAgaWYgKGNvbmZfLmF1dG9jbG9zZSAhPT0gZmFsc2UpIHtcbiAgICAgICAgcmVzdWx0cy5vbmNlKCdkb25lJywgZnVuY3Rpb24gKCkgeyByZXN1bHRzLmNsb3NlKCkgfSk7XG4gICAgfVxuICAgIFxuICAgIHZhciB0ZXN0ID0gZnVuY3Rpb24gKG5hbWUsIGNvbmYsIGNiKSB7XG4gICAgICAgIHZhciB0ID0gbmV3IFRlc3QobmFtZSwgY29uZiwgY2IpO1xuICAgICAgICB0ZXN0Ll90ZXN0cy5wdXNoKHQpO1xuICAgICAgICBcbiAgICAgICAgKGZ1bmN0aW9uIGluc3BlY3RDb2RlIChzdCkge1xuICAgICAgICAgICAgc3Qub24oJ3Rlc3QnLCBmdW5jdGlvbiBzdWIgKHN0Xykge1xuICAgICAgICAgICAgICAgIGluc3BlY3RDb2RlKHN0Xyk7XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIHN0Lm9uKCdyZXN1bHQnLCBmdW5jdGlvbiAocikge1xuICAgICAgICAgICAgICAgIGlmICghci5vayAmJiB0eXBlb2YgciAhPT0gJ3N0cmluZycpIHRlc3QuX2V4aXRDb2RlID0gMVxuICAgICAgICAgICAgfSk7XG4gICAgICAgIH0pKHQpO1xuICAgICAgICBcbiAgICAgICAgcmVzdWx0cy5wdXNoKHQpO1xuICAgICAgICByZXR1cm4gdDtcbiAgICB9O1xuICAgIHRlc3QuX3Jlc3VsdHMgPSByZXN1bHRzO1xuICAgIFxuICAgIHRlc3QuX3Rlc3RzID0gW107XG4gICAgXG4gICAgdGVzdC5jcmVhdGVTdHJlYW0gPSBmdW5jdGlvbiAob3B0cykge1xuICAgICAgICByZXR1cm4gcmVzdWx0cy5jcmVhdGVTdHJlYW0ob3B0cyk7XG4gICAgfTtcblxuICAgIHRlc3Qub25GaW5pc2ggPSBmdW5jdGlvbiAoY2IpIHtcbiAgICAgICAgcmVzdWx0cy5vbignZG9uZScsIGNiKTtcbiAgICB9O1xuICAgIFxuICAgIHZhciBvbmx5ID0gZmFsc2U7XG4gICAgdGVzdC5vbmx5ID0gZnVuY3Rpb24gKG5hbWUpIHtcbiAgICAgICAgaWYgKG9ubHkpIHRocm93IG5ldyBFcnJvcigndGhlcmUgY2FuIG9ubHkgYmUgb25lIG9ubHkgdGVzdCcpO1xuICAgICAgICByZXN1bHRzLm9ubHkobmFtZSk7XG4gICAgICAgIG9ubHkgPSB0cnVlO1xuICAgICAgICByZXR1cm4gdGVzdC5hcHBseShudWxsLCBhcmd1bWVudHMpO1xuICAgIH07XG4gICAgdGVzdC5fZXhpdENvZGUgPSAwO1xuICAgIFxuICAgIHRlc3QuY2xvc2UgPSBmdW5jdGlvbiAoKSB7IHJlc3VsdHMuY2xvc2UoKSB9O1xuICAgIFxuICAgIHJldHVybiB0ZXN0O1xufVxuIiwidmFyIHRocm91Z2ggPSByZXF1aXJlKCd0aHJvdWdoJyk7XG52YXIgZnMgPSByZXF1aXJlKCdmcycpO1xuXG5tb2R1bGUuZXhwb3J0cyA9IGZ1bmN0aW9uICgpIHtcbiAgICB2YXIgbGluZSA9ICcnO1xuICAgIHZhciBzdHJlYW0gPSB0aHJvdWdoKHdyaXRlLCBmbHVzaCk7XG4gICAgcmV0dXJuIHN0cmVhbTtcbiAgICBcbiAgICBmdW5jdGlvbiB3cml0ZSAoYnVmKSB7XG4gICAgICAgIGZvciAodmFyIGkgPSAwOyBpIDwgYnVmLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICB2YXIgYyA9IHR5cGVvZiBidWYgPT09ICdzdHJpbmcnXG4gICAgICAgICAgICAgICAgPyBidWYuY2hhckF0KGkpXG4gICAgICAgICAgICAgICAgOiBTdHJpbmcuZnJvbUNoYXJDb2RlKGJ1ZltpXSlcbiAgICAgICAgICAgIDtcbiAgICAgICAgICAgIGlmIChjID09PSAnXFxuJykgZmx1c2goKTtcbiAgICAgICAgICAgIGVsc2UgbGluZSArPSBjO1xuICAgICAgICB9XG4gICAgfVxuICAgIFxuICAgIGZ1bmN0aW9uIGZsdXNoICgpIHtcbiAgICAgICAgaWYgKGZzLndyaXRlU3luYyAmJiAvXndpbi8udGVzdChwcm9jZXNzLnBsYXRmb3JtKSkge1xuICAgICAgICAgICAgdHJ5IHsgZnMud3JpdGVTeW5jKDEsIGxpbmUgKyAnXFxuJyk7IH1cbiAgICAgICAgICAgIGNhdGNoIChlKSB7IHN0cmVhbS5lbWl0KCdlcnJvcicsIGUpIH1cbiAgICAgICAgfVxuICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgIHRyeSB7IGNvbnNvbGUubG9nKGxpbmUpIH1cbiAgICAgICAgICAgIGNhdGNoIChlKSB7IHN0cmVhbS5lbWl0KCdlcnJvcicsIGUpIH1cbiAgICAgICAgfVxuICAgICAgICBsaW5lID0gJyc7XG4gICAgfVxufTtcbiIsInZhciBFdmVudEVtaXR0ZXIgPSByZXF1aXJlKCdldmVudHMnKS5FdmVudEVtaXR0ZXI7XG52YXIgaW5oZXJpdHMgPSByZXF1aXJlKCdpbmhlcml0cycpO1xudmFyIHRocm91Z2ggPSByZXF1aXJlKCd0aHJvdWdoJyk7XG52YXIgcmVzdW1lciA9IHJlcXVpcmUoJ3Jlc3VtZXInKTtcbnZhciBpbnNwZWN0ID0gcmVxdWlyZSgnb2JqZWN0LWluc3BlY3QnKTtcbnZhciBiaW5kID0gcmVxdWlyZSgnZnVuY3Rpb24tYmluZCcpO1xudmFyIGhhcyA9IHJlcXVpcmUoJ2hhcycpO1xudmFyIHJlZ2V4cFRlc3QgPSBiaW5kLmNhbGwoRnVuY3Rpb24uY2FsbCwgUmVnRXhwLnByb3RvdHlwZS50ZXN0KTtcbnZhciB5YW1sSW5kaWNhdG9ycyA9IC9cXDp8XFwtfFxcPy87XG52YXIgbmV4dFRpY2sgPSB0eXBlb2Ygc2V0SW1tZWRpYXRlICE9PSAndW5kZWZpbmVkJ1xuICAgID8gc2V0SW1tZWRpYXRlXG4gICAgOiBwcm9jZXNzLm5leHRUaWNrXG47XG5cbm1vZHVsZS5leHBvcnRzID0gUmVzdWx0cztcbmluaGVyaXRzKFJlc3VsdHMsIEV2ZW50RW1pdHRlcik7XG5cbmZ1bmN0aW9uIFJlc3VsdHMgKCkge1xuICAgIGlmICghKHRoaXMgaW5zdGFuY2VvZiBSZXN1bHRzKSkgcmV0dXJuIG5ldyBSZXN1bHRzO1xuICAgIHRoaXMuY291bnQgPSAwO1xuICAgIHRoaXMuZmFpbCA9IDA7XG4gICAgdGhpcy5wYXNzID0gMDtcbiAgICB0aGlzLl9zdHJlYW0gPSB0aHJvdWdoKCk7XG4gICAgdGhpcy50ZXN0cyA9IFtdO1xufVxuXG5SZXN1bHRzLnByb3RvdHlwZS5jcmVhdGVTdHJlYW0gPSBmdW5jdGlvbiAob3B0cykge1xuICAgIGlmICghb3B0cykgb3B0cyA9IHt9O1xuICAgIHZhciBzZWxmID0gdGhpcztcbiAgICB2YXIgb3V0cHV0LCB0ZXN0SWQgPSAwO1xuICAgIGlmIChvcHRzLm9iamVjdE1vZGUpIHtcbiAgICAgICAgb3V0cHV0ID0gdGhyb3VnaCgpO1xuICAgICAgICBzZWxmLm9uKCdfcHVzaCcsIGZ1bmN0aW9uIG9udGVzdCAodCwgZXh0cmEpIHtcbiAgICAgICAgICAgIGlmICghZXh0cmEpIGV4dHJhID0ge307XG4gICAgICAgICAgICB2YXIgaWQgPSB0ZXN0SWQrKztcbiAgICAgICAgICAgIHQub25jZSgncHJlcnVuJywgZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgICAgIHZhciByb3cgPSB7XG4gICAgICAgICAgICAgICAgICAgIHR5cGU6ICd0ZXN0JyxcbiAgICAgICAgICAgICAgICAgICAgbmFtZTogdC5uYW1lLFxuICAgICAgICAgICAgICAgICAgICBpZDogaWRcbiAgICAgICAgICAgICAgICB9O1xuICAgICAgICAgICAgICAgIGlmIChoYXMoZXh0cmEsICdwYXJlbnQnKSkge1xuICAgICAgICAgICAgICAgICAgICByb3cucGFyZW50ID0gZXh0cmEucGFyZW50O1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBvdXRwdXQucXVldWUocm93KTtcbiAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgdC5vbigndGVzdCcsIGZ1bmN0aW9uIChzdCkge1xuICAgICAgICAgICAgICAgIG9udGVzdChzdCwgeyBwYXJlbnQ6IGlkIH0pO1xuICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICB0Lm9uKCdyZXN1bHQnLCBmdW5jdGlvbiAocmVzKSB7XG4gICAgICAgICAgICAgICAgcmVzLnRlc3QgPSBpZDtcbiAgICAgICAgICAgICAgICByZXMudHlwZSA9ICdhc3NlcnQnO1xuICAgICAgICAgICAgICAgIG91dHB1dC5xdWV1ZShyZXMpO1xuICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICB0Lm9uKCdlbmQnLCBmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICAgICAgb3V0cHV0LnF1ZXVlKHsgdHlwZTogJ2VuZCcsIHRlc3Q6IGlkIH0pO1xuICAgICAgICAgICAgfSk7XG4gICAgICAgIH0pO1xuICAgICAgICBzZWxmLm9uKCdkb25lJywgZnVuY3Rpb24gKCkgeyBvdXRwdXQucXVldWUobnVsbCkgfSk7XG4gICAgfVxuICAgIGVsc2Uge1xuICAgICAgICBvdXRwdXQgPSByZXN1bWVyKCk7XG4gICAgICAgIG91dHB1dC5xdWV1ZSgnVEFQIHZlcnNpb24gMTNcXG4nKTtcbiAgICAgICAgc2VsZi5fc3RyZWFtLnBpcGUob3V0cHV0KTtcbiAgICB9XG4gICAgXG4gICAgbmV4dFRpY2soZnVuY3Rpb24gbmV4dCgpIHtcbiAgICAgICAgdmFyIHQ7XG4gICAgICAgIHdoaWxlICh0ID0gZ2V0TmV4dFRlc3Qoc2VsZikpIHtcbiAgICAgICAgICAgIHQucnVuKCk7XG4gICAgICAgICAgICBpZiAoIXQuZW5kZWQpIHJldHVybiB0Lm9uY2UoJ2VuZCcsIGZ1bmN0aW9uKCl7IG5leHRUaWNrKG5leHQpOyB9KTtcbiAgICAgICAgfVxuICAgICAgICBzZWxmLmVtaXQoJ2RvbmUnKTtcbiAgICB9KTtcbiAgICBcbiAgICByZXR1cm4gb3V0cHV0O1xufTtcblxuUmVzdWx0cy5wcm90b3R5cGUucHVzaCA9IGZ1bmN0aW9uICh0KSB7XG4gICAgdmFyIHNlbGYgPSB0aGlzO1xuICAgIHNlbGYudGVzdHMucHVzaCh0KTtcbiAgICBzZWxmLl93YXRjaCh0KTtcbiAgICBzZWxmLmVtaXQoJ19wdXNoJywgdCk7XG59O1xuXG5SZXN1bHRzLnByb3RvdHlwZS5vbmx5ID0gZnVuY3Rpb24gKG5hbWUpIHtcbiAgICB0aGlzLl9vbmx5ID0gbmFtZTtcbn07XG5cblJlc3VsdHMucHJvdG90eXBlLl93YXRjaCA9IGZ1bmN0aW9uICh0KSB7XG4gICAgdmFyIHNlbGYgPSB0aGlzO1xuICAgIHZhciB3cml0ZSA9IGZ1bmN0aW9uIChzKSB7IHNlbGYuX3N0cmVhbS5xdWV1ZShzKSB9O1xuICAgIHQub25jZSgncHJlcnVuJywgZnVuY3Rpb24gKCkge1xuICAgICAgICB3cml0ZSgnIyAnICsgdC5uYW1lICsgJ1xcbicpO1xuICAgIH0pO1xuICAgIFxuICAgIHQub24oJ3Jlc3VsdCcsIGZ1bmN0aW9uIChyZXMpIHtcbiAgICAgICAgaWYgKHR5cGVvZiByZXMgPT09ICdzdHJpbmcnKSB7XG4gICAgICAgICAgICB3cml0ZSgnIyAnICsgcmVzICsgJ1xcbicpO1xuICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG4gICAgICAgIHdyaXRlKGVuY29kZVJlc3VsdChyZXMsIHNlbGYuY291bnQgKyAxKSk7XG4gICAgICAgIHNlbGYuY291bnQgKys7XG5cbiAgICAgICAgaWYgKHJlcy5vaykgc2VsZi5wYXNzICsrXG4gICAgICAgIGVsc2Ugc2VsZi5mYWlsICsrXG4gICAgfSk7XG4gICAgXG4gICAgdC5vbigndGVzdCcsIGZ1bmN0aW9uIChzdCkgeyBzZWxmLl93YXRjaChzdCkgfSk7XG59O1xuXG5SZXN1bHRzLnByb3RvdHlwZS5jbG9zZSA9IGZ1bmN0aW9uICgpIHtcbiAgICB2YXIgc2VsZiA9IHRoaXM7XG4gICAgaWYgKHNlbGYuY2xvc2VkKSBzZWxmLl9zdHJlYW0uZW1pdCgnZXJyb3InLCBuZXcgRXJyb3IoJ0FMUkVBRFkgQ0xPU0VEJykpO1xuICAgIHNlbGYuY2xvc2VkID0gdHJ1ZTtcbiAgICB2YXIgd3JpdGUgPSBmdW5jdGlvbiAocykgeyBzZWxmLl9zdHJlYW0ucXVldWUocykgfTtcbiAgICBcbiAgICB3cml0ZSgnXFxuMS4uJyArIHNlbGYuY291bnQgKyAnXFxuJyk7XG4gICAgd3JpdGUoJyMgdGVzdHMgJyArIHNlbGYuY291bnQgKyAnXFxuJyk7XG4gICAgd3JpdGUoJyMgcGFzcyAgJyArIHNlbGYucGFzcyArICdcXG4nKTtcbiAgICBpZiAoc2VsZi5mYWlsKSB3cml0ZSgnIyBmYWlsICAnICsgc2VsZi5mYWlsICsgJ1xcbicpXG4gICAgZWxzZSB3cml0ZSgnXFxuIyBva1xcbicpXG5cbiAgICBzZWxmLl9zdHJlYW0ucXVldWUobnVsbCk7XG59O1xuXG5mdW5jdGlvbiBlbmNvZGVSZXN1bHQgKHJlcywgY291bnQpIHtcbiAgICB2YXIgb3V0cHV0ID0gJyc7XG4gICAgb3V0cHV0ICs9IChyZXMub2sgPyAnb2sgJyA6ICdub3Qgb2sgJykgKyBjb3VudDtcbiAgICBvdXRwdXQgKz0gcmVzLm5hbWUgPyAnICcgKyByZXMubmFtZS50b1N0cmluZygpLnJlcGxhY2UoL1xccysvZywgJyAnKSA6ICcnO1xuICAgIFxuICAgIGlmIChyZXMuc2tpcCkgb3V0cHV0ICs9ICcgIyBTS0lQJztcbiAgICBlbHNlIGlmIChyZXMudG9kbykgb3V0cHV0ICs9ICcgIyBUT0RPJztcbiAgICBcbiAgICBvdXRwdXQgKz0gJ1xcbic7XG4gICAgaWYgKHJlcy5vaykgcmV0dXJuIG91dHB1dDtcbiAgICBcbiAgICB2YXIgb3V0ZXIgPSAnICAnO1xuICAgIHZhciBpbm5lciA9IG91dGVyICsgJyAgJztcbiAgICBvdXRwdXQgKz0gb3V0ZXIgKyAnLS0tXFxuJztcbiAgICBvdXRwdXQgKz0gaW5uZXIgKyAnb3BlcmF0b3I6ICcgKyByZXMub3BlcmF0b3IgKyAnXFxuJztcbiAgICBcbiAgICBpZiAoaGFzKHJlcywgJ2V4cGVjdGVkJykgfHwgaGFzKHJlcywgJ2FjdHVhbCcpKSB7XG4gICAgICAgIHZhciBleCA9IGluc3BlY3QocmVzLmV4cGVjdGVkKTtcbiAgICAgICAgdmFyIGFjID0gaW5zcGVjdChyZXMuYWN0dWFsKTtcbiAgICAgICAgXG4gICAgICAgIGlmIChNYXRoLm1heChleC5sZW5ndGgsIGFjLmxlbmd0aCkgPiA2NSB8fCBpbnZhbGlkWWFtbChleCkgfHwgaW52YWxpZFlhbWwoYWMpKSB7XG4gICAgICAgICAgICBvdXRwdXQgKz0gaW5uZXIgKyAnZXhwZWN0ZWQ6IHwtXFxuJyArIGlubmVyICsgJyAgJyArIGV4ICsgJ1xcbic7XG4gICAgICAgICAgICBvdXRwdXQgKz0gaW5uZXIgKyAnYWN0dWFsOiB8LVxcbicgKyBpbm5lciArICcgICcgKyBhYyArICdcXG4nO1xuICAgICAgICB9XG4gICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgb3V0cHV0ICs9IGlubmVyICsgJ2V4cGVjdGVkOiAnICsgZXggKyAnXFxuJztcbiAgICAgICAgICAgIG91dHB1dCArPSBpbm5lciArICdhY3R1YWw6ICAgJyArIGFjICsgJ1xcbic7XG4gICAgICAgIH1cbiAgICB9XG4gICAgaWYgKHJlcy5hdCkge1xuICAgICAgICBvdXRwdXQgKz0gaW5uZXIgKyAnYXQ6ICcgKyByZXMuYXQgKyAnXFxuJztcbiAgICB9XG4gICAgaWYgKHJlcy5vcGVyYXRvciA9PT0gJ2Vycm9yJyAmJiByZXMuYWN0dWFsICYmIHJlcy5hY3R1YWwuc3RhY2spIHtcbiAgICAgICAgdmFyIGxpbmVzID0gU3RyaW5nKHJlcy5hY3R1YWwuc3RhY2spLnNwbGl0KCdcXG4nKTtcbiAgICAgICAgb3V0cHV0ICs9IGlubmVyICsgJ3N0YWNrOiB8LVxcbic7XG4gICAgICAgIGZvciAodmFyIGkgPSAwOyBpIDwgbGluZXMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgIG91dHB1dCArPSBpbm5lciArICcgICcgKyBsaW5lc1tpXSArICdcXG4nO1xuICAgICAgICB9XG4gICAgfVxuICAgIFxuICAgIG91dHB1dCArPSBvdXRlciArICcuLi5cXG4nO1xuICAgIHJldHVybiBvdXRwdXQ7XG59XG5cbmZ1bmN0aW9uIGdldE5leHRUZXN0IChyZXN1bHRzKSB7XG4gICAgaWYgKCFyZXN1bHRzLl9vbmx5KSB7XG4gICAgICAgIHJldHVybiByZXN1bHRzLnRlc3RzLnNoaWZ0KCk7XG4gICAgfVxuICAgIFxuICAgIGRvIHtcbiAgICAgICAgdmFyIHQgPSByZXN1bHRzLnRlc3RzLnNoaWZ0KCk7XG4gICAgICAgIGlmICghdCkgY29udGludWU7XG4gICAgICAgIGlmIChyZXN1bHRzLl9vbmx5ID09PSB0Lm5hbWUpIHtcbiAgICAgICAgICAgIHJldHVybiB0O1xuICAgICAgICB9XG4gICAgfSB3aGlsZSAocmVzdWx0cy50ZXN0cy5sZW5ndGggIT09IDApXG59XG5cbmZ1bmN0aW9uIGludmFsaWRZYW1sIChzdHIpIHtcbiAgICByZXR1cm4gcmVnZXhwVGVzdCh5YW1sSW5kaWNhdG9ycywgc3RyKTtcbn1cbiIsInZhciBkZWVwRXF1YWwgPSByZXF1aXJlKCdkZWVwLWVxdWFsJyk7XG52YXIgZGVmaW5lZCA9IHJlcXVpcmUoJ2RlZmluZWQnKTtcbnZhciBwYXRoID0gcmVxdWlyZSgncGF0aCcpO1xudmFyIGluaGVyaXRzID0gcmVxdWlyZSgnaW5oZXJpdHMnKTtcbnZhciBFdmVudEVtaXR0ZXIgPSByZXF1aXJlKCdldmVudHMnKS5FdmVudEVtaXR0ZXI7XG52YXIgaGFzID0gcmVxdWlyZSgnaGFzJyk7XG52YXIgdHJpbSA9IHJlcXVpcmUoJ3N0cmluZy5wcm90b3R5cGUudHJpbScpO1xuXG5tb2R1bGUuZXhwb3J0cyA9IFRlc3Q7XG5cbnZhciBuZXh0VGljayA9IHR5cGVvZiBzZXRJbW1lZGlhdGUgIT09ICd1bmRlZmluZWQnXG4gICAgPyBzZXRJbW1lZGlhdGVcbiAgICA6IHByb2Nlc3MubmV4dFRpY2tcbjtcblxuaW5oZXJpdHMoVGVzdCwgRXZlbnRFbWl0dGVyKTtcblxudmFyIGdldFRlc3RBcmdzID0gZnVuY3Rpb24gKG5hbWVfLCBvcHRzXywgY2JfKSB7XG4gICAgdmFyIG5hbWUgPSAnKGFub255bW91cyknO1xuICAgIHZhciBvcHRzID0ge307XG4gICAgdmFyIGNiO1xuXG4gICAgZm9yICh2YXIgaSA9IDA7IGkgPCBhcmd1bWVudHMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgdmFyIGFyZyA9IGFyZ3VtZW50c1tpXTtcbiAgICAgICAgdmFyIHQgPSB0eXBlb2YgYXJnO1xuICAgICAgICBpZiAodCA9PT0gJ3N0cmluZycpIHtcbiAgICAgICAgICAgIG5hbWUgPSBhcmc7XG4gICAgICAgIH1cbiAgICAgICAgZWxzZSBpZiAodCA9PT0gJ29iamVjdCcpIHtcbiAgICAgICAgICAgIG9wdHMgPSBhcmcgfHwgb3B0cztcbiAgICAgICAgfVxuICAgICAgICBlbHNlIGlmICh0ID09PSAnZnVuY3Rpb24nKSB7XG4gICAgICAgICAgICBjYiA9IGFyZztcbiAgICAgICAgfVxuICAgIH1cbiAgICByZXR1cm4geyBuYW1lOiBuYW1lLCBvcHRzOiBvcHRzLCBjYjogY2IgfTtcbn07XG5cbmZ1bmN0aW9uIFRlc3QgKG5hbWVfLCBvcHRzXywgY2JfKSB7XG4gICAgaWYgKCEgKHRoaXMgaW5zdGFuY2VvZiBUZXN0KSkge1xuICAgICAgICByZXR1cm4gbmV3IFRlc3QobmFtZV8sIG9wdHNfLCBjYl8pO1xuICAgIH1cblxuICAgIHZhciBhcmdzID0gZ2V0VGVzdEFyZ3MobmFtZV8sIG9wdHNfLCBjYl8pO1xuXG4gICAgdGhpcy5yZWFkYWJsZSA9IHRydWU7XG4gICAgdGhpcy5uYW1lID0gYXJncy5uYW1lIHx8ICcoYW5vbnltb3VzKSc7XG4gICAgdGhpcy5hc3NlcnRDb3VudCA9IDA7XG4gICAgdGhpcy5wZW5kaW5nQ291bnQgPSAwO1xuICAgIHRoaXMuX3NraXAgPSBhcmdzLm9wdHMuc2tpcCB8fCBmYWxzZTtcbiAgICB0aGlzLl90aW1lb3V0ID0gYXJncy5vcHRzLnRpbWVvdXQ7XG4gICAgdGhpcy5fcGxhbiA9IHVuZGVmaW5lZDtcbiAgICB0aGlzLl9jYiA9IGFyZ3MuY2I7XG4gICAgdGhpcy5fcHJvZ2VueSA9IFtdO1xuICAgIHRoaXMuX29rID0gdHJ1ZTtcblxuICAgIGZvciAodmFyIHByb3AgaW4gdGhpcykge1xuICAgICAgICB0aGlzW3Byb3BdID0gKGZ1bmN0aW9uIGJpbmQoc2VsZiwgdmFsKSB7XG4gICAgICAgICAgICBpZiAodHlwZW9mIHZhbCA9PT0gJ2Z1bmN0aW9uJykge1xuICAgICAgICAgICAgICAgIHJldHVybiBmdW5jdGlvbiBib3VuZCgpIHtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIHZhbC5hcHBseShzZWxmLCBhcmd1bWVudHMpO1xuICAgICAgICAgICAgICAgIH07XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBlbHNlIHJldHVybiB2YWw7XG4gICAgICAgIH0pKHRoaXMsIHRoaXNbcHJvcF0pO1xuICAgIH1cbn1cblxuVGVzdC5wcm90b3R5cGUucnVuID0gZnVuY3Rpb24gKCkge1xuICAgIGlmICghdGhpcy5fY2IgfHwgdGhpcy5fc2tpcCkge1xuICAgICAgICByZXR1cm4gdGhpcy5fZW5kKCk7XG4gICAgfVxuICAgIGlmICh0aGlzLl90aW1lb3V0ICE9IG51bGwpIHtcbiAgICAgICAgdGhpcy50aW1lb3V0QWZ0ZXIodGhpcy5fdGltZW91dCk7XG4gICAgfVxuICAgIHRoaXMuZW1pdCgncHJlcnVuJyk7XG4gICAgdGhpcy5fY2IodGhpcyk7XG4gICAgdGhpcy5lbWl0KCdydW4nKTtcbn07XG5cblRlc3QucHJvdG90eXBlLnRlc3QgPSBmdW5jdGlvbiAobmFtZSwgb3B0cywgY2IpIHtcbiAgICB2YXIgc2VsZiA9IHRoaXM7XG4gICAgdmFyIHQgPSBuZXcgVGVzdChuYW1lLCBvcHRzLCBjYik7XG4gICAgdGhpcy5fcHJvZ2VueS5wdXNoKHQpO1xuICAgIHRoaXMucGVuZGluZ0NvdW50Kys7XG4gICAgdGhpcy5lbWl0KCd0ZXN0JywgdCk7XG4gICAgdC5vbigncHJlcnVuJywgZnVuY3Rpb24gKCkge1xuICAgICAgICBzZWxmLmFzc2VydENvdW50Kys7XG4gICAgfSlcbiAgICBcbiAgICBpZiAoIXNlbGYuX3BlbmRpbmdBc3NlcnRzKCkpIHtcbiAgICAgICAgbmV4dFRpY2soZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgc2VsZi5fZW5kKCk7XG4gICAgICAgIH0pO1xuICAgIH1cbiAgICBcbiAgICBuZXh0VGljayhmdW5jdGlvbigpIHtcbiAgICAgICAgaWYgKCFzZWxmLl9wbGFuICYmIHNlbGYucGVuZGluZ0NvdW50ID09IHNlbGYuX3Byb2dlbnkubGVuZ3RoKSB7XG4gICAgICAgICAgICBzZWxmLl9lbmQoKTtcbiAgICAgICAgfVxuICAgIH0pO1xufTtcblxuVGVzdC5wcm90b3R5cGUuY29tbWVudCA9IGZ1bmN0aW9uIChtc2cpIHtcbiAgICB0aGlzLmVtaXQoJ3Jlc3VsdCcsIHRyaW0obXNnKS5yZXBsYWNlKC9eI1xccyovLCAnJykpO1xufTtcblxuVGVzdC5wcm90b3R5cGUucGxhbiA9IGZ1bmN0aW9uIChuKSB7XG4gICAgdGhpcy5fcGxhbiA9IG47XG4gICAgdGhpcy5lbWl0KCdwbGFuJywgbik7XG59O1xuXG5UZXN0LnByb3RvdHlwZS50aW1lb3V0QWZ0ZXIgPSBmdW5jdGlvbihtcykge1xuICAgIGlmICghbXMpIHRocm93IG5ldyBFcnJvcigndGltZW91dEFmdGVyIHJlcXVpcmVzIGEgdGltZXNwYW4nKTtcbiAgICB2YXIgc2VsZiA9IHRoaXM7XG4gICAgdmFyIHRpbWVvdXQgPSBzZXRUaW1lb3V0KGZ1bmN0aW9uKCkge1xuICAgICAgICBzZWxmLmZhaWwoJ3Rlc3QgdGltZWQgb3V0IGFmdGVyICcgKyBtcyArICdtcycpO1xuICAgICAgICBzZWxmLmVuZCgpO1xuICAgIH0sIG1zKTtcbiAgICB0aGlzLm9uY2UoJ2VuZCcsIGZ1bmN0aW9uKCkge1xuICAgICAgICBjbGVhclRpbWVvdXQodGltZW91dCk7XG4gICAgfSk7XG59XG5cblRlc3QucHJvdG90eXBlLmVuZCA9IGZ1bmN0aW9uIChlcnIpIHsgXG4gICAgdmFyIHNlbGYgPSB0aGlzO1xuICAgIGlmIChhcmd1bWVudHMubGVuZ3RoID49IDEgJiYgISFlcnIpIHtcbiAgICAgICAgdGhpcy5pZkVycm9yKGVycik7XG4gICAgfVxuICAgIFxuICAgIGlmICh0aGlzLmNhbGxlZEVuZCkge1xuICAgICAgICB0aGlzLmZhaWwoJy5lbmQoKSBjYWxsZWQgdHdpY2UnKTtcbiAgICB9XG4gICAgdGhpcy5jYWxsZWRFbmQgPSB0cnVlO1xuICAgIHRoaXMuX2VuZCgpO1xufTtcblxuVGVzdC5wcm90b3R5cGUuX2VuZCA9IGZ1bmN0aW9uIChlcnIpIHtcbiAgICB2YXIgc2VsZiA9IHRoaXM7XG4gICAgaWYgKHRoaXMuX3Byb2dlbnkubGVuZ3RoKSB7XG4gICAgICAgIHZhciB0ID0gdGhpcy5fcHJvZ2VueS5zaGlmdCgpO1xuICAgICAgICB0Lm9uKCdlbmQnLCBmdW5jdGlvbiAoKSB7IHNlbGYuX2VuZCgpIH0pO1xuICAgICAgICB0LnJ1bigpO1xuICAgICAgICByZXR1cm47XG4gICAgfVxuICAgIFxuICAgIGlmICghdGhpcy5lbmRlZCkgdGhpcy5lbWl0KCdlbmQnKTtcbiAgICB2YXIgcGVuZGluZ0Fzc2VydHMgPSB0aGlzLl9wZW5kaW5nQXNzZXJ0cygpO1xuICAgIGlmICghdGhpcy5fcGxhbkVycm9yICYmIHRoaXMuX3BsYW4gIT09IHVuZGVmaW5lZCAmJiBwZW5kaW5nQXNzZXJ0cykge1xuICAgICAgICB0aGlzLl9wbGFuRXJyb3IgPSB0cnVlO1xuICAgICAgICB0aGlzLmZhaWwoJ3BsYW4gIT0gY291bnQnLCB7XG4gICAgICAgICAgICBleHBlY3RlZCA6IHRoaXMuX3BsYW4sXG4gICAgICAgICAgICBhY3R1YWwgOiB0aGlzLmFzc2VydENvdW50XG4gICAgICAgIH0pO1xuICAgIH1cbiAgICB0aGlzLmVuZGVkID0gdHJ1ZTtcbn07XG5cblRlc3QucHJvdG90eXBlLl9leGl0ID0gZnVuY3Rpb24gKCkge1xuICAgIGlmICh0aGlzLl9wbGFuICE9PSB1bmRlZmluZWQgJiZcbiAgICAgICAgIXRoaXMuX3BsYW5FcnJvciAmJiB0aGlzLmFzc2VydENvdW50ICE9PSB0aGlzLl9wbGFuKSB7XG4gICAgICAgIHRoaXMuX3BsYW5FcnJvciA9IHRydWU7XG4gICAgICAgIHRoaXMuZmFpbCgncGxhbiAhPSBjb3VudCcsIHtcbiAgICAgICAgICAgIGV4cGVjdGVkIDogdGhpcy5fcGxhbixcbiAgICAgICAgICAgIGFjdHVhbCA6IHRoaXMuYXNzZXJ0Q291bnQsXG4gICAgICAgICAgICBleGl0aW5nIDogdHJ1ZVxuICAgICAgICB9KTtcbiAgICB9XG4gICAgZWxzZSBpZiAoIXRoaXMuZW5kZWQpIHtcbiAgICAgICAgdGhpcy5mYWlsKCd0ZXN0IGV4aXRlZCB3aXRob3V0IGVuZGluZycsIHtcbiAgICAgICAgICAgIGV4aXRpbmc6IHRydWVcbiAgICAgICAgfSk7XG4gICAgfVxufTtcblxuVGVzdC5wcm90b3R5cGUuX3BlbmRpbmdBc3NlcnRzID0gZnVuY3Rpb24gKCkge1xuICAgIGlmICh0aGlzLl9wbGFuID09PSB1bmRlZmluZWQpIHtcbiAgICAgICAgcmV0dXJuIDE7XG4gICAgfVxuICAgIGVsc2Uge1xuICAgICAgICByZXR1cm4gdGhpcy5fcGxhbiAtICh0aGlzLl9wcm9nZW55Lmxlbmd0aCArIHRoaXMuYXNzZXJ0Q291bnQpO1xuICAgIH1cbn07XG5cblRlc3QucHJvdG90eXBlLl9hc3NlcnQgPSBmdW5jdGlvbiBhc3NlcnQgKG9rLCBvcHRzKSB7XG4gICAgdmFyIHNlbGYgPSB0aGlzO1xuICAgIHZhciBleHRyYSA9IG9wdHMuZXh0cmEgfHwge307XG4gICAgXG4gICAgdmFyIHJlcyA9IHtcbiAgICAgICAgaWQgOiBzZWxmLmFzc2VydENvdW50ICsrLFxuICAgICAgICBvayA6IEJvb2xlYW4ob2spLFxuICAgICAgICBza2lwIDogZGVmaW5lZChleHRyYS5za2lwLCBvcHRzLnNraXApLFxuICAgICAgICBuYW1lIDogZGVmaW5lZChleHRyYS5tZXNzYWdlLCBvcHRzLm1lc3NhZ2UsICcodW5uYW1lZCBhc3NlcnQpJyksXG4gICAgICAgIG9wZXJhdG9yIDogZGVmaW5lZChleHRyYS5vcGVyYXRvciwgb3B0cy5vcGVyYXRvcilcbiAgICB9O1xuICAgIGlmIChoYXMob3B0cywgJ2FjdHVhbCcpIHx8IGhhcyhleHRyYSwgJ2FjdHVhbCcpKSB7XG4gICAgICAgIHJlcy5hY3R1YWwgPSBkZWZpbmVkKGV4dHJhLmFjdHVhbCwgb3B0cy5hY3R1YWwpO1xuICAgIH1cbiAgICBpZiAoaGFzKG9wdHMsICdleHBlY3RlZCcpIHx8IGhhcyhleHRyYSwgJ2V4cGVjdGVkJykpIHtcbiAgICAgICAgcmVzLmV4cGVjdGVkID0gZGVmaW5lZChleHRyYS5leHBlY3RlZCwgb3B0cy5leHBlY3RlZCk7XG4gICAgfVxuICAgIHRoaXMuX29rID0gQm9vbGVhbih0aGlzLl9vayAmJiBvayk7XG4gICAgXG4gICAgaWYgKCFvaykge1xuICAgICAgICByZXMuZXJyb3IgPSBkZWZpbmVkKGV4dHJhLmVycm9yLCBvcHRzLmVycm9yLCBuZXcgRXJyb3IocmVzLm5hbWUpKTtcbiAgICB9XG4gICAgXG4gICAgaWYgKCFvaykge1xuICAgICAgICB2YXIgZSA9IG5ldyBFcnJvcignZXhjZXB0aW9uJyk7XG4gICAgICAgIHZhciBlcnIgPSAoZS5zdGFjayB8fCAnJykuc3BsaXQoJ1xcbicpO1xuICAgICAgICB2YXIgZGlyID0gcGF0aC5kaXJuYW1lKF9fZGlybmFtZSkgKyAnLyc7XG4gICAgICAgIFxuICAgICAgICBmb3IgKHZhciBpID0gMDsgaSA8IGVyci5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgdmFyIG0gPSAvXlteXFxzXSpcXHMqXFxiYXRcXHMrKC4rKS8uZXhlYyhlcnJbaV0pO1xuICAgICAgICAgICAgaWYgKCFtKSB7XG4gICAgICAgICAgICAgICAgY29udGludWU7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBcbiAgICAgICAgICAgIHZhciBzID0gbVsxXS5zcGxpdCgvXFxzKy8pO1xuICAgICAgICAgICAgdmFyIGZpbGVtID0gLyhcXC9bXjpcXHNdKzooXFxkKykoPzo6KFxcZCspKT8pLy5leGVjKHNbMV0pO1xuICAgICAgICAgICAgaWYgKCFmaWxlbSkge1xuICAgICAgICAgICAgICAgIGZpbGVtID0gLyhcXC9bXjpcXHNdKzooXFxkKykoPzo6KFxcZCspKT8pLy5leGVjKHNbMl0pO1xuICAgICAgICAgICAgICAgIFxuICAgICAgICAgICAgICAgIGlmICghZmlsZW0pIHtcbiAgICAgICAgICAgICAgICAgICAgZmlsZW0gPSAvKFxcL1teOlxcc10rOihcXGQrKSg/OjooXFxkKykpPykvLmV4ZWMoc1szXSk7XG5cbiAgICAgICAgICAgICAgICAgICAgaWYgKCFmaWxlbSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgY29udGludWU7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBcbiAgICAgICAgICAgIGlmIChmaWxlbVsxXS5zbGljZSgwLCBkaXIubGVuZ3RoKSA9PT0gZGlyKSB7XG4gICAgICAgICAgICAgICAgY29udGludWU7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBcbiAgICAgICAgICAgIHJlcy5mdW5jdGlvbk5hbWUgPSBzWzBdO1xuICAgICAgICAgICAgcmVzLmZpbGUgPSBmaWxlbVsxXTtcbiAgICAgICAgICAgIHJlcy5saW5lID0gTnVtYmVyKGZpbGVtWzJdKTtcbiAgICAgICAgICAgIGlmIChmaWxlbVszXSkgcmVzLmNvbHVtbiA9IGZpbGVtWzNdO1xuICAgICAgICAgICAgXG4gICAgICAgICAgICByZXMuYXQgPSBtWzFdO1xuICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBzZWxmLmVtaXQoJ3Jlc3VsdCcsIHJlcyk7XG4gICAgXG4gICAgdmFyIHBlbmRpbmdBc3NlcnRzID0gc2VsZi5fcGVuZGluZ0Fzc2VydHMoKTtcbiAgICBpZiAoIXBlbmRpbmdBc3NlcnRzKSB7XG4gICAgICAgIGlmIChleHRyYS5leGl0aW5nKSB7XG4gICAgICAgICAgICBzZWxmLl9lbmQoKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIG5leHRUaWNrKGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgICAgICBzZWxmLl9lbmQoKTtcbiAgICAgICAgICAgIH0pO1xuICAgICAgICB9XG4gICAgfVxuICAgIFxuICAgIGlmICghc2VsZi5fcGxhbkVycm9yICYmIHBlbmRpbmdBc3NlcnRzIDwgMCkge1xuICAgICAgICBzZWxmLl9wbGFuRXJyb3IgPSB0cnVlO1xuICAgICAgICBzZWxmLmZhaWwoJ3BsYW4gIT0gY291bnQnLCB7XG4gICAgICAgICAgICBleHBlY3RlZCA6IHNlbGYuX3BsYW4sXG4gICAgICAgICAgICBhY3R1YWwgOiBzZWxmLl9wbGFuIC0gcGVuZGluZ0Fzc2VydHNcbiAgICAgICAgfSk7XG4gICAgfVxufTtcblxuVGVzdC5wcm90b3R5cGUuZmFpbCA9IGZ1bmN0aW9uIChtc2csIGV4dHJhKSB7XG4gICAgdGhpcy5fYXNzZXJ0KGZhbHNlLCB7XG4gICAgICAgIG1lc3NhZ2UgOiBtc2csXG4gICAgICAgIG9wZXJhdG9yIDogJ2ZhaWwnLFxuICAgICAgICBleHRyYSA6IGV4dHJhXG4gICAgfSk7XG59O1xuXG5UZXN0LnByb3RvdHlwZS5wYXNzID0gZnVuY3Rpb24gKG1zZywgZXh0cmEpIHtcbiAgICB0aGlzLl9hc3NlcnQodHJ1ZSwge1xuICAgICAgICBtZXNzYWdlIDogbXNnLFxuICAgICAgICBvcGVyYXRvciA6ICdwYXNzJyxcbiAgICAgICAgZXh0cmEgOiBleHRyYVxuICAgIH0pO1xufTtcblxuVGVzdC5wcm90b3R5cGUuc2tpcCA9IGZ1bmN0aW9uIChtc2csIGV4dHJhKSB7XG4gICAgdGhpcy5fYXNzZXJ0KHRydWUsIHtcbiAgICAgICAgbWVzc2FnZSA6IG1zZyxcbiAgICAgICAgb3BlcmF0b3IgOiAnc2tpcCcsXG4gICAgICAgIHNraXAgOiB0cnVlLFxuICAgICAgICBleHRyYSA6IGV4dHJhXG4gICAgfSk7XG59O1xuXG5UZXN0LnByb3RvdHlwZS5va1xuPSBUZXN0LnByb3RvdHlwZVsndHJ1ZSddXG49IFRlc3QucHJvdG90eXBlLmFzc2VydFxuPSBmdW5jdGlvbiAodmFsdWUsIG1zZywgZXh0cmEpIHtcbiAgICB0aGlzLl9hc3NlcnQodmFsdWUsIHtcbiAgICAgICAgbWVzc2FnZSA6IG1zZyxcbiAgICAgICAgb3BlcmF0b3IgOiAnb2snLFxuICAgICAgICBleHBlY3RlZCA6IHRydWUsXG4gICAgICAgIGFjdHVhbCA6IHZhbHVlLFxuICAgICAgICBleHRyYSA6IGV4dHJhXG4gICAgfSk7XG59O1xuXG5UZXN0LnByb3RvdHlwZS5ub3RPa1xuPSBUZXN0LnByb3RvdHlwZVsnZmFsc2UnXVxuPSBUZXN0LnByb3RvdHlwZS5ub3Rva1xuPSBmdW5jdGlvbiAodmFsdWUsIG1zZywgZXh0cmEpIHtcbiAgICB0aGlzLl9hc3NlcnQoIXZhbHVlLCB7XG4gICAgICAgIG1lc3NhZ2UgOiBtc2csXG4gICAgICAgIG9wZXJhdG9yIDogJ25vdE9rJyxcbiAgICAgICAgZXhwZWN0ZWQgOiBmYWxzZSxcbiAgICAgICAgYWN0dWFsIDogdmFsdWUsXG4gICAgICAgIGV4dHJhIDogZXh0cmFcbiAgICB9KTtcbn07XG5cblRlc3QucHJvdG90eXBlLmVycm9yXG49IFRlc3QucHJvdG90eXBlLmlmRXJyb3Jcbj0gVGVzdC5wcm90b3R5cGUuaWZFcnJcbj0gVGVzdC5wcm90b3R5cGUuaWZlcnJvclxuPSBmdW5jdGlvbiAoZXJyLCBtc2csIGV4dHJhKSB7XG4gICAgdGhpcy5fYXNzZXJ0KCFlcnIsIHtcbiAgICAgICAgbWVzc2FnZSA6IGRlZmluZWQobXNnLCBTdHJpbmcoZXJyKSksXG4gICAgICAgIG9wZXJhdG9yIDogJ2Vycm9yJyxcbiAgICAgICAgYWN0dWFsIDogZXJyLFxuICAgICAgICBleHRyYSA6IGV4dHJhXG4gICAgfSk7XG59O1xuXG5UZXN0LnByb3RvdHlwZS5lcXVhbFxuPSBUZXN0LnByb3RvdHlwZS5lcXVhbHNcbj0gVGVzdC5wcm90b3R5cGUuaXNFcXVhbFxuPSBUZXN0LnByb3RvdHlwZS5pc1xuPSBUZXN0LnByb3RvdHlwZS5zdHJpY3RFcXVhbFxuPSBUZXN0LnByb3RvdHlwZS5zdHJpY3RFcXVhbHNcbj0gZnVuY3Rpb24gKGEsIGIsIG1zZywgZXh0cmEpIHtcbiAgICB0aGlzLl9hc3NlcnQoYSA9PT0gYiwge1xuICAgICAgICBtZXNzYWdlIDogZGVmaW5lZChtc2csICdzaG91bGQgYmUgZXF1YWwnKSxcbiAgICAgICAgb3BlcmF0b3IgOiAnZXF1YWwnLFxuICAgICAgICBhY3R1YWwgOiBhLFxuICAgICAgICBleHBlY3RlZCA6IGIsXG4gICAgICAgIGV4dHJhIDogZXh0cmFcbiAgICB9KTtcbn07XG5cblRlc3QucHJvdG90eXBlLm5vdEVxdWFsXG49IFRlc3QucHJvdG90eXBlLm5vdEVxdWFsc1xuPSBUZXN0LnByb3RvdHlwZS5ub3RTdHJpY3RFcXVhbFxuPSBUZXN0LnByb3RvdHlwZS5ub3RTdHJpY3RFcXVhbHNcbj0gVGVzdC5wcm90b3R5cGUuaXNOb3RFcXVhbFxuPSBUZXN0LnByb3RvdHlwZS5pc05vdFxuPSBUZXN0LnByb3RvdHlwZS5ub3Rcbj0gVGVzdC5wcm90b3R5cGUuZG9lc05vdEVxdWFsXG49IFRlc3QucHJvdG90eXBlLmlzSW5lcXVhbFxuPSBmdW5jdGlvbiAoYSwgYiwgbXNnLCBleHRyYSkge1xuICAgIHRoaXMuX2Fzc2VydChhICE9PSBiLCB7XG4gICAgICAgIG1lc3NhZ2UgOiBkZWZpbmVkKG1zZywgJ3Nob3VsZCBub3QgYmUgZXF1YWwnKSxcbiAgICAgICAgb3BlcmF0b3IgOiAnbm90RXF1YWwnLFxuICAgICAgICBhY3R1YWwgOiBhLFxuICAgICAgICBub3RFeHBlY3RlZCA6IGIsXG4gICAgICAgIGV4dHJhIDogZXh0cmFcbiAgICB9KTtcbn07XG5cblRlc3QucHJvdG90eXBlLmRlZXBFcXVhbFxuPSBUZXN0LnByb3RvdHlwZS5kZWVwRXF1YWxzXG49IFRlc3QucHJvdG90eXBlLmlzRXF1aXZhbGVudFxuPSBUZXN0LnByb3RvdHlwZS5zYW1lXG49IGZ1bmN0aW9uIChhLCBiLCBtc2csIGV4dHJhKSB7XG4gICAgdGhpcy5fYXNzZXJ0KGRlZXBFcXVhbChhLCBiLCB7IHN0cmljdDogdHJ1ZSB9KSwge1xuICAgICAgICBtZXNzYWdlIDogZGVmaW5lZChtc2csICdzaG91bGQgYmUgZXF1aXZhbGVudCcpLFxuICAgICAgICBvcGVyYXRvciA6ICdkZWVwRXF1YWwnLFxuICAgICAgICBhY3R1YWwgOiBhLFxuICAgICAgICBleHBlY3RlZCA6IGIsXG4gICAgICAgIGV4dHJhIDogZXh0cmFcbiAgICB9KTtcbn07XG5cblRlc3QucHJvdG90eXBlLmRlZXBMb29zZUVxdWFsXG49IFRlc3QucHJvdG90eXBlLmxvb3NlRXF1YWxcbj0gVGVzdC5wcm90b3R5cGUubG9vc2VFcXVhbHNcbj0gZnVuY3Rpb24gKGEsIGIsIG1zZywgZXh0cmEpIHtcbiAgICB0aGlzLl9hc3NlcnQoZGVlcEVxdWFsKGEsIGIpLCB7XG4gICAgICAgIG1lc3NhZ2UgOiBkZWZpbmVkKG1zZywgJ3Nob3VsZCBiZSBlcXVpdmFsZW50JyksXG4gICAgICAgIG9wZXJhdG9yIDogJ2RlZXBMb29zZUVxdWFsJyxcbiAgICAgICAgYWN0dWFsIDogYSxcbiAgICAgICAgZXhwZWN0ZWQgOiBiLFxuICAgICAgICBleHRyYSA6IGV4dHJhXG4gICAgfSk7XG59O1xuXG5UZXN0LnByb3RvdHlwZS5ub3REZWVwRXF1YWxcbj0gVGVzdC5wcm90b3R5cGUubm90RXF1aXZhbGVudFxuPSBUZXN0LnByb3RvdHlwZS5ub3REZWVwbHlcbj0gVGVzdC5wcm90b3R5cGUubm90U2FtZVxuPSBUZXN0LnByb3RvdHlwZS5pc05vdERlZXBFcXVhbFxuPSBUZXN0LnByb3RvdHlwZS5pc05vdERlZXBseVxuPSBUZXN0LnByb3RvdHlwZS5pc05vdEVxdWl2YWxlbnRcbj0gVGVzdC5wcm90b3R5cGUuaXNJbmVxdWl2YWxlbnRcbj0gZnVuY3Rpb24gKGEsIGIsIG1zZywgZXh0cmEpIHtcbiAgICB0aGlzLl9hc3NlcnQoIWRlZXBFcXVhbChhLCBiLCB7IHN0cmljdDogdHJ1ZSB9KSwge1xuICAgICAgICBtZXNzYWdlIDogZGVmaW5lZChtc2csICdzaG91bGQgbm90IGJlIGVxdWl2YWxlbnQnKSxcbiAgICAgICAgb3BlcmF0b3IgOiAnbm90RGVlcEVxdWFsJyxcbiAgICAgICAgYWN0dWFsIDogYSxcbiAgICAgICAgbm90RXhwZWN0ZWQgOiBiLFxuICAgICAgICBleHRyYSA6IGV4dHJhXG4gICAgfSk7XG59O1xuXG5UZXN0LnByb3RvdHlwZS5ub3REZWVwTG9vc2VFcXVhbFxuPSBUZXN0LnByb3RvdHlwZS5ub3RMb29zZUVxdWFsXG49IFRlc3QucHJvdG90eXBlLm5vdExvb3NlRXF1YWxzXG49IGZ1bmN0aW9uIChhLCBiLCBtc2csIGV4dHJhKSB7XG4gICAgdGhpcy5fYXNzZXJ0KCFkZWVwRXF1YWwoYSwgYiksIHtcbiAgICAgICAgbWVzc2FnZSA6IGRlZmluZWQobXNnLCAnc2hvdWxkIGJlIGVxdWl2YWxlbnQnKSxcbiAgICAgICAgb3BlcmF0b3IgOiAnbm90RGVlcExvb3NlRXF1YWwnLFxuICAgICAgICBhY3R1YWwgOiBhLFxuICAgICAgICBleHBlY3RlZCA6IGIsXG4gICAgICAgIGV4dHJhIDogZXh0cmFcbiAgICB9KTtcbn07XG5cblRlc3QucHJvdG90eXBlWyd0aHJvd3MnXSA9IGZ1bmN0aW9uIChmbiwgZXhwZWN0ZWQsIG1zZywgZXh0cmEpIHtcbiAgICBpZiAodHlwZW9mIGV4cGVjdGVkID09PSAnc3RyaW5nJykge1xuICAgICAgICBtc2cgPSBleHBlY3RlZDtcbiAgICAgICAgZXhwZWN0ZWQgPSB1bmRlZmluZWQ7XG4gICAgfVxuXG4gICAgdmFyIGNhdWdodCA9IHVuZGVmaW5lZDtcblxuICAgIHRyeSB7XG4gICAgICAgIGZuKCk7XG4gICAgfSBjYXRjaCAoZXJyKSB7XG4gICAgICAgIGNhdWdodCA9IHsgZXJyb3IgOiBlcnIgfTtcbiAgICAgICAgdmFyIG1lc3NhZ2UgPSBlcnIubWVzc2FnZTtcbiAgICAgICAgZGVsZXRlIGVyci5tZXNzYWdlO1xuICAgICAgICBlcnIubWVzc2FnZSA9IG1lc3NhZ2U7XG4gICAgfVxuXG4gICAgdmFyIHBhc3NlZCA9IGNhdWdodDtcblxuICAgIGlmIChleHBlY3RlZCBpbnN0YW5jZW9mIFJlZ0V4cCkge1xuICAgICAgICBwYXNzZWQgPSBleHBlY3RlZC50ZXN0KGNhdWdodCAmJiBjYXVnaHQuZXJyb3IpO1xuICAgICAgICBleHBlY3RlZCA9IFN0cmluZyhleHBlY3RlZCk7XG4gICAgfVxuXG4gICAgaWYgKHR5cGVvZiBleHBlY3RlZCA9PT0gJ2Z1bmN0aW9uJyAmJiBjYXVnaHQpIHtcbiAgICAgICAgcGFzc2VkID0gY2F1Z2h0LmVycm9yIGluc3RhbmNlb2YgZXhwZWN0ZWQ7XG4gICAgICAgIGNhdWdodC5lcnJvciA9IGNhdWdodC5lcnJvci5jb25zdHJ1Y3RvcjtcbiAgICB9XG5cbiAgICB0aGlzLl9hc3NlcnQocGFzc2VkLCB7XG4gICAgICAgIG1lc3NhZ2UgOiBkZWZpbmVkKG1zZywgJ3Nob3VsZCB0aHJvdycpLFxuICAgICAgICBvcGVyYXRvciA6ICd0aHJvd3MnLFxuICAgICAgICBhY3R1YWwgOiBjYXVnaHQgJiYgY2F1Z2h0LmVycm9yLFxuICAgICAgICBleHBlY3RlZCA6IGV4cGVjdGVkLFxuICAgICAgICBlcnJvcjogIXBhc3NlZCAmJiBjYXVnaHQgJiYgY2F1Z2h0LmVycm9yLFxuICAgICAgICBleHRyYSA6IGV4dHJhXG4gICAgfSk7XG59O1xuXG5UZXN0LnByb3RvdHlwZS5kb2VzTm90VGhyb3cgPSBmdW5jdGlvbiAoZm4sIGV4cGVjdGVkLCBtc2csIGV4dHJhKSB7XG4gICAgaWYgKHR5cGVvZiBleHBlY3RlZCA9PT0gJ3N0cmluZycpIHtcbiAgICAgICAgbXNnID0gZXhwZWN0ZWQ7XG4gICAgICAgIGV4cGVjdGVkID0gdW5kZWZpbmVkO1xuICAgIH1cbiAgICB2YXIgY2F1Z2h0ID0gdW5kZWZpbmVkO1xuICAgIHRyeSB7XG4gICAgICAgIGZuKCk7XG4gICAgfVxuICAgIGNhdGNoIChlcnIpIHtcbiAgICAgICAgY2F1Z2h0ID0geyBlcnJvciA6IGVyciB9O1xuICAgIH1cbiAgICB0aGlzLl9hc3NlcnQoIWNhdWdodCwge1xuICAgICAgICBtZXNzYWdlIDogZGVmaW5lZChtc2csICdzaG91bGQgbm90IHRocm93JyksXG4gICAgICAgIG9wZXJhdG9yIDogJ3Rocm93cycsXG4gICAgICAgIGFjdHVhbCA6IGNhdWdodCAmJiBjYXVnaHQuZXJyb3IsXG4gICAgICAgIGV4cGVjdGVkIDogZXhwZWN0ZWQsXG4gICAgICAgIGVycm9yIDogY2F1Z2h0ICYmIGNhdWdodC5lcnJvcixcbiAgICAgICAgZXh0cmEgOiBleHRyYVxuICAgIH0pO1xufTtcblxuVGVzdC5za2lwID0gZnVuY3Rpb24gKG5hbWVfLCBfb3B0cywgX2NiKSB7XG4gICAgdmFyIGFyZ3MgPSBnZXRUZXN0QXJncy5hcHBseShudWxsLCBhcmd1bWVudHMpO1xuICAgIGFyZ3Mub3B0cy5za2lwID0gdHJ1ZTtcbiAgICByZXR1cm4gVGVzdChhcmdzLm5hbWUsIGFyZ3Mub3B0cywgYXJncy5jYik7XG59O1xuXG4vLyB2aW06IHNldCBzb2Z0dGFic3RvcD00IHNoaWZ0d2lkdGg9NDpcblxuIiwidmFyIHBTbGljZSA9IEFycmF5LnByb3RvdHlwZS5zbGljZTtcbnZhciBvYmplY3RLZXlzID0gcmVxdWlyZSgnLi9saWIva2V5cy5qcycpO1xudmFyIGlzQXJndW1lbnRzID0gcmVxdWlyZSgnLi9saWIvaXNfYXJndW1lbnRzLmpzJyk7XG5cbnZhciBkZWVwRXF1YWwgPSBtb2R1bGUuZXhwb3J0cyA9IGZ1bmN0aW9uIChhY3R1YWwsIGV4cGVjdGVkLCBvcHRzKSB7XG4gIGlmICghb3B0cykgb3B0cyA9IHt9O1xuICAvLyA3LjEuIEFsbCBpZGVudGljYWwgdmFsdWVzIGFyZSBlcXVpdmFsZW50LCBhcyBkZXRlcm1pbmVkIGJ5ID09PS5cbiAgaWYgKGFjdHVhbCA9PT0gZXhwZWN0ZWQpIHtcbiAgICByZXR1cm4gdHJ1ZTtcblxuICB9IGVsc2UgaWYgKGFjdHVhbCBpbnN0YW5jZW9mIERhdGUgJiYgZXhwZWN0ZWQgaW5zdGFuY2VvZiBEYXRlKSB7XG4gICAgcmV0dXJuIGFjdHVhbC5nZXRUaW1lKCkgPT09IGV4cGVjdGVkLmdldFRpbWUoKTtcblxuICAvLyA3LjMuIE90aGVyIHBhaXJzIHRoYXQgZG8gbm90IGJvdGggcGFzcyB0eXBlb2YgdmFsdWUgPT0gJ29iamVjdCcsXG4gIC8vIGVxdWl2YWxlbmNlIGlzIGRldGVybWluZWQgYnkgPT0uXG4gIH0gZWxzZSBpZiAoIWFjdHVhbCB8fCAhZXhwZWN0ZWQgfHwgdHlwZW9mIGFjdHVhbCAhPSAnb2JqZWN0JyAmJiB0eXBlb2YgZXhwZWN0ZWQgIT0gJ29iamVjdCcpIHtcbiAgICByZXR1cm4gb3B0cy5zdHJpY3QgPyBhY3R1YWwgPT09IGV4cGVjdGVkIDogYWN0dWFsID09IGV4cGVjdGVkO1xuXG4gIC8vIDcuNC4gRm9yIGFsbCBvdGhlciBPYmplY3QgcGFpcnMsIGluY2x1ZGluZyBBcnJheSBvYmplY3RzLCBlcXVpdmFsZW5jZSBpc1xuICAvLyBkZXRlcm1pbmVkIGJ5IGhhdmluZyB0aGUgc2FtZSBudW1iZXIgb2Ygb3duZWQgcHJvcGVydGllcyAoYXMgdmVyaWZpZWRcbiAgLy8gd2l0aCBPYmplY3QucHJvdG90eXBlLmhhc093blByb3BlcnR5LmNhbGwpLCB0aGUgc2FtZSBzZXQgb2Yga2V5c1xuICAvLyAoYWx0aG91Z2ggbm90IG5lY2Vzc2FyaWx5IHRoZSBzYW1lIG9yZGVyKSwgZXF1aXZhbGVudCB2YWx1ZXMgZm9yIGV2ZXJ5XG4gIC8vIGNvcnJlc3BvbmRpbmcga2V5LCBhbmQgYW4gaWRlbnRpY2FsICdwcm90b3R5cGUnIHByb3BlcnR5LiBOb3RlOiB0aGlzXG4gIC8vIGFjY291bnRzIGZvciBib3RoIG5hbWVkIGFuZCBpbmRleGVkIHByb3BlcnRpZXMgb24gQXJyYXlzLlxuICB9IGVsc2Uge1xuICAgIHJldHVybiBvYmpFcXVpdihhY3R1YWwsIGV4cGVjdGVkLCBvcHRzKTtcbiAgfVxufVxuXG5mdW5jdGlvbiBpc1VuZGVmaW5lZE9yTnVsbCh2YWx1ZSkge1xuICByZXR1cm4gdmFsdWUgPT09IG51bGwgfHwgdmFsdWUgPT09IHVuZGVmaW5lZDtcbn1cblxuZnVuY3Rpb24gaXNCdWZmZXIgKHgpIHtcbiAgaWYgKCF4IHx8IHR5cGVvZiB4ICE9PSAnb2JqZWN0JyB8fCB0eXBlb2YgeC5sZW5ndGggIT09ICdudW1iZXInKSByZXR1cm4gZmFsc2U7XG4gIGlmICh0eXBlb2YgeC5jb3B5ICE9PSAnZnVuY3Rpb24nIHx8IHR5cGVvZiB4LnNsaWNlICE9PSAnZnVuY3Rpb24nKSB7XG4gICAgcmV0dXJuIGZhbHNlO1xuICB9XG4gIGlmICh4Lmxlbmd0aCA+IDAgJiYgdHlwZW9mIHhbMF0gIT09ICdudW1iZXInKSByZXR1cm4gZmFsc2U7XG4gIHJldHVybiB0cnVlO1xufVxuXG5mdW5jdGlvbiBvYmpFcXVpdihhLCBiLCBvcHRzKSB7XG4gIHZhciBpLCBrZXk7XG4gIGlmIChpc1VuZGVmaW5lZE9yTnVsbChhKSB8fCBpc1VuZGVmaW5lZE9yTnVsbChiKSlcbiAgICByZXR1cm4gZmFsc2U7XG4gIC8vIGFuIGlkZW50aWNhbCAncHJvdG90eXBlJyBwcm9wZXJ0eS5cbiAgaWYgKGEucHJvdG90eXBlICE9PSBiLnByb3RvdHlwZSkgcmV0dXJuIGZhbHNlO1xuICAvL35+fkkndmUgbWFuYWdlZCB0byBicmVhayBPYmplY3Qua2V5cyB0aHJvdWdoIHNjcmV3eSBhcmd1bWVudHMgcGFzc2luZy5cbiAgLy8gICBDb252ZXJ0aW5nIHRvIGFycmF5IHNvbHZlcyB0aGUgcHJvYmxlbS5cbiAgaWYgKGlzQXJndW1lbnRzKGEpKSB7XG4gICAgaWYgKCFpc0FyZ3VtZW50cyhiKSkge1xuICAgICAgcmV0dXJuIGZhbHNlO1xuICAgIH1cbiAgICBhID0gcFNsaWNlLmNhbGwoYSk7XG4gICAgYiA9IHBTbGljZS5jYWxsKGIpO1xuICAgIHJldHVybiBkZWVwRXF1YWwoYSwgYiwgb3B0cyk7XG4gIH1cbiAgaWYgKGlzQnVmZmVyKGEpKSB7XG4gICAgaWYgKCFpc0J1ZmZlcihiKSkge1xuICAgICAgcmV0dXJuIGZhbHNlO1xuICAgIH1cbiAgICBpZiAoYS5sZW5ndGggIT09IGIubGVuZ3RoKSByZXR1cm4gZmFsc2U7XG4gICAgZm9yIChpID0gMDsgaSA8IGEubGVuZ3RoOyBpKyspIHtcbiAgICAgIGlmIChhW2ldICE9PSBiW2ldKSByZXR1cm4gZmFsc2U7XG4gICAgfVxuICAgIHJldHVybiB0cnVlO1xuICB9XG4gIHRyeSB7XG4gICAgdmFyIGthID0gb2JqZWN0S2V5cyhhKSxcbiAgICAgICAga2IgPSBvYmplY3RLZXlzKGIpO1xuICB9IGNhdGNoIChlKSB7Ly9oYXBwZW5zIHdoZW4gb25lIGlzIGEgc3RyaW5nIGxpdGVyYWwgYW5kIHRoZSBvdGhlciBpc24ndFxuICAgIHJldHVybiBmYWxzZTtcbiAgfVxuICAvLyBoYXZpbmcgdGhlIHNhbWUgbnVtYmVyIG9mIG93bmVkIHByb3BlcnRpZXMgKGtleXMgaW5jb3Jwb3JhdGVzXG4gIC8vIGhhc093blByb3BlcnR5KVxuICBpZiAoa2EubGVuZ3RoICE9IGtiLmxlbmd0aClcbiAgICByZXR1cm4gZmFsc2U7XG4gIC8vdGhlIHNhbWUgc2V0IG9mIGtleXMgKGFsdGhvdWdoIG5vdCBuZWNlc3NhcmlseSB0aGUgc2FtZSBvcmRlciksXG4gIGthLnNvcnQoKTtcbiAga2Iuc29ydCgpO1xuICAvL35+fmNoZWFwIGtleSB0ZXN0XG4gIGZvciAoaSA9IGthLmxlbmd0aCAtIDE7IGkgPj0gMDsgaS0tKSB7XG4gICAgaWYgKGthW2ldICE9IGtiW2ldKVxuICAgICAgcmV0dXJuIGZhbHNlO1xuICB9XG4gIC8vZXF1aXZhbGVudCB2YWx1ZXMgZm9yIGV2ZXJ5IGNvcnJlc3BvbmRpbmcga2V5LCBhbmRcbiAgLy9+fn5wb3NzaWJseSBleHBlbnNpdmUgZGVlcCB0ZXN0XG4gIGZvciAoaSA9IGthLmxlbmd0aCAtIDE7IGkgPj0gMDsgaS0tKSB7XG4gICAga2V5ID0ga2FbaV07XG4gICAgaWYgKCFkZWVwRXF1YWwoYVtrZXldLCBiW2tleV0sIG9wdHMpKSByZXR1cm4gZmFsc2U7XG4gIH1cbiAgcmV0dXJuIHR5cGVvZiBhID09PSB0eXBlb2YgYjtcbn1cbiIsIm1vZHVsZS5leHBvcnRzID0gZnVuY3Rpb24gKCkge1xuICAgIGZvciAodmFyIGkgPSAwOyBpIDwgYXJndW1lbnRzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgIGlmIChhcmd1bWVudHNbaV0gIT09IHVuZGVmaW5lZCkgcmV0dXJuIGFyZ3VtZW50c1tpXTtcbiAgICB9XG59O1xuIiwidmFyIEVSUk9SX01FU1NBR0UgPSAnRnVuY3Rpb24ucHJvdG90eXBlLmJpbmQgY2FsbGVkIG9uIGluY29tcGF0aWJsZSAnO1xudmFyIHNsaWNlID0gQXJyYXkucHJvdG90eXBlLnNsaWNlO1xudmFyIHRvU3RyID0gT2JqZWN0LnByb3RvdHlwZS50b1N0cmluZztcbnZhciBmdW5jVHlwZSA9ICdbb2JqZWN0IEZ1bmN0aW9uXSc7XG5cbm1vZHVsZS5leHBvcnRzID0gZnVuY3Rpb24gYmluZCh0aGF0KSB7XG4gICAgdmFyIHRhcmdldCA9IHRoaXM7XG4gICAgaWYgKHR5cGVvZiB0YXJnZXQgIT09ICdmdW5jdGlvbicgfHwgdG9TdHIuY2FsbCh0YXJnZXQpICE9PSBmdW5jVHlwZSkge1xuICAgICAgICB0aHJvdyBuZXcgVHlwZUVycm9yKEVSUk9SX01FU1NBR0UgKyB0YXJnZXQpO1xuICAgIH1cbiAgICB2YXIgYXJncyA9IHNsaWNlLmNhbGwoYXJndW1lbnRzLCAxKTtcblxuICAgIHZhciBiaW5kZXIgPSBmdW5jdGlvbiAoKSB7XG4gICAgICAgIGlmICh0aGlzIGluc3RhbmNlb2YgYm91bmQpIHtcbiAgICAgICAgICAgIHZhciByZXN1bHQgPSB0YXJnZXQuYXBwbHkoXG4gICAgICAgICAgICAgICAgdGhpcyxcbiAgICAgICAgICAgICAgICBhcmdzLmNvbmNhdChzbGljZS5jYWxsKGFyZ3VtZW50cykpXG4gICAgICAgICAgICApO1xuICAgICAgICAgICAgaWYgKE9iamVjdChyZXN1bHQpID09PSByZXN1bHQpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gcmVzdWx0O1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgcmV0dXJuIHRoaXM7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICByZXR1cm4gdGFyZ2V0LmFwcGx5KFxuICAgICAgICAgICAgICAgIHRoYXQsXG4gICAgICAgICAgICAgICAgYXJncy5jb25jYXQoc2xpY2UuY2FsbChhcmd1bWVudHMpKVxuICAgICAgICAgICAgKTtcbiAgICAgICAgfVxuICAgIH07XG5cbiAgICB2YXIgYm91bmRMZW5ndGggPSBNYXRoLm1heCgwLCB0YXJnZXQubGVuZ3RoIC0gYXJncy5sZW5ndGgpO1xuICAgIHZhciBib3VuZEFyZ3MgPSBbXTtcbiAgICBmb3IgKHZhciBpID0gMDsgaSA8IGJvdW5kTGVuZ3RoOyBpKyspIHtcbiAgICAgICAgYm91bmRBcmdzLnB1c2goJyQnICsgaSk7XG4gICAgfVxuXG4gICAgdmFyIGJvdW5kID0gRnVuY3Rpb24oJ2JpbmRlcicsICdyZXR1cm4gZnVuY3Rpb24gKCcgKyBib3VuZEFyZ3Muam9pbignLCcpICsgJyl7IHJldHVybiBiaW5kZXIuYXBwbHkodGhpcyxhcmd1bWVudHMpOyB9JykoYmluZGVyKTtcblxuICAgIGlmICh0YXJnZXQucHJvdG90eXBlKSB7XG4gICAgICAgIHZhciBFbXB0eSA9IGZ1bmN0aW9uIEVtcHR5KCkge307XG4gICAgICAgIEVtcHR5LnByb3RvdHlwZSA9IHRhcmdldC5wcm90b3R5cGU7XG4gICAgICAgIGJvdW5kLnByb3RvdHlwZSA9IG5ldyBFbXB0eSgpO1xuICAgICAgICBFbXB0eS5wcm90b3R5cGUgPSBudWxsO1xuICAgIH1cblxuICAgIHJldHVybiBib3VuZDtcbn07XG5cbiIsInZhciBiaW5kID0gcmVxdWlyZSgnZnVuY3Rpb24tYmluZCcpO1xuXG5tb2R1bGUuZXhwb3J0cyA9IGJpbmQuY2FsbChGdW5jdGlvbi5jYWxsLCBPYmplY3QucHJvdG90eXBlLmhhc093blByb3BlcnR5KTtcbiIsImlmICh0eXBlb2YgT2JqZWN0LmNyZWF0ZSA9PT0gJ2Z1bmN0aW9uJykge1xuICAvLyBpbXBsZW1lbnRhdGlvbiBmcm9tIHN0YW5kYXJkIG5vZGUuanMgJ3V0aWwnIG1vZHVsZVxuICBtb2R1bGUuZXhwb3J0cyA9IGZ1bmN0aW9uIGluaGVyaXRzKGN0b3IsIHN1cGVyQ3Rvcikge1xuICAgIGN0b3Iuc3VwZXJfID0gc3VwZXJDdG9yXG4gICAgY3Rvci5wcm90b3R5cGUgPSBPYmplY3QuY3JlYXRlKHN1cGVyQ3Rvci5wcm90b3R5cGUsIHtcbiAgICAgIGNvbnN0cnVjdG9yOiB7XG4gICAgICAgIHZhbHVlOiBjdG9yLFxuICAgICAgICBlbnVtZXJhYmxlOiBmYWxzZSxcbiAgICAgICAgd3JpdGFibGU6IHRydWUsXG4gICAgICAgIGNvbmZpZ3VyYWJsZTogdHJ1ZVxuICAgICAgfVxuICAgIH0pO1xuICB9O1xufSBlbHNlIHtcbiAgLy8gb2xkIHNjaG9vbCBzaGltIGZvciBvbGQgYnJvd3NlcnNcbiAgbW9kdWxlLmV4cG9ydHMgPSBmdW5jdGlvbiBpbmhlcml0cyhjdG9yLCBzdXBlckN0b3IpIHtcbiAgICBjdG9yLnN1cGVyXyA9IHN1cGVyQ3RvclxuICAgIHZhciBUZW1wQ3RvciA9IGZ1bmN0aW9uICgpIHt9XG4gICAgVGVtcEN0b3IucHJvdG90eXBlID0gc3VwZXJDdG9yLnByb3RvdHlwZVxuICAgIGN0b3IucHJvdG90eXBlID0gbmV3IFRlbXBDdG9yKClcbiAgICBjdG9yLnByb3RvdHlwZS5jb25zdHJ1Y3RvciA9IGN0b3JcbiAgfVxufVxuIiwibW9kdWxlLmV4cG9ydHMgPSBmdW5jdGlvbiBpbnNwZWN0XyAob2JqLCBvcHRzLCBkZXB0aCwgc2Vlbikge1xuICAgIGlmICghb3B0cykgb3B0cyA9IHt9O1xuICAgIFxuICAgIHZhciBtYXhEZXB0aCA9IG9wdHMuZGVwdGggPT09IHVuZGVmaW5lZCA/IDUgOiBvcHRzLmRlcHRoO1xuICAgIGlmIChkZXB0aCA9PT0gdW5kZWZpbmVkKSBkZXB0aCA9IDA7XG4gICAgaWYgKGRlcHRoID49IG1heERlcHRoICYmIG1heERlcHRoID4gMFxuICAgICYmIG9iaiAmJiB0eXBlb2Ygb2JqID09PSAnb2JqZWN0Jykge1xuICAgICAgICByZXR1cm4gJ1tPYmplY3RdJztcbiAgICB9XG4gICAgXG4gICAgaWYgKHNlZW4gPT09IHVuZGVmaW5lZCkgc2VlbiA9IFtdO1xuICAgIGVsc2UgaWYgKGluZGV4T2Yoc2Vlbiwgb2JqKSA+PSAwKSB7XG4gICAgICAgIHJldHVybiAnW0NpcmN1bGFyXSc7XG4gICAgfVxuICAgIFxuICAgIGZ1bmN0aW9uIGluc3BlY3QgKHZhbHVlLCBmcm9tKSB7XG4gICAgICAgIGlmIChmcm9tKSB7XG4gICAgICAgICAgICBzZWVuID0gc2Vlbi5zbGljZSgpO1xuICAgICAgICAgICAgc2Vlbi5wdXNoKGZyb20pO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiBpbnNwZWN0Xyh2YWx1ZSwgb3B0cywgZGVwdGggKyAxLCBzZWVuKTtcbiAgICB9XG4gICAgXG4gICAgaWYgKHR5cGVvZiBvYmogPT09ICdzdHJpbmcnKSB7XG4gICAgICAgIHJldHVybiBpbnNwZWN0U3RyaW5nKG9iaik7XG4gICAgfVxuICAgIGVsc2UgaWYgKHR5cGVvZiBvYmogPT09ICdmdW5jdGlvbicpIHtcbiAgICAgICAgdmFyIG5hbWUgPSBuYW1lT2Yob2JqKTtcbiAgICAgICAgcmV0dXJuICdbRnVuY3Rpb24nICsgKG5hbWUgPyAnOiAnICsgbmFtZSA6ICcnKSArICddJztcbiAgICB9XG4gICAgZWxzZSBpZiAob2JqID09PSBudWxsKSB7XG4gICAgICAgIHJldHVybiAnbnVsbCc7XG4gICAgfVxuICAgIGVsc2UgaWYgKGlzU3ltYm9sKG9iaikpIHtcbiAgICAgICAgdmFyIHN5bVN0cmluZyA9IFN5bWJvbC5wcm90b3R5cGUudG9TdHJpbmcuY2FsbChvYmopO1xuICAgICAgICByZXR1cm4gdHlwZW9mIG9iaiA9PT0gJ29iamVjdCcgPyAnT2JqZWN0KCcgKyBzeW1TdHJpbmcgKyAnKScgOiBzeW1TdHJpbmc7XG4gICAgfVxuICAgIGVsc2UgaWYgKGlzRWxlbWVudChvYmopKSB7XG4gICAgICAgIHZhciBzID0gJzwnICsgU3RyaW5nKG9iai5ub2RlTmFtZSkudG9Mb3dlckNhc2UoKTtcbiAgICAgICAgdmFyIGF0dHJzID0gb2JqLmF0dHJpYnV0ZXMgfHwgW107XG4gICAgICAgIGZvciAodmFyIGkgPSAwOyBpIDwgYXR0cnMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgIHMgKz0gJyAnICsgYXR0cnNbaV0ubmFtZSArICc9XCInICsgcXVvdGUoYXR0cnNbaV0udmFsdWUpICsgJ1wiJztcbiAgICAgICAgfVxuICAgICAgICBzICs9ICc+JztcbiAgICAgICAgaWYgKG9iai5jaGlsZE5vZGVzICYmIG9iai5jaGlsZE5vZGVzLmxlbmd0aCkgcyArPSAnLi4uJztcbiAgICAgICAgcyArPSAnPC8nICsgU3RyaW5nKG9iai5ub2RlTmFtZSkudG9Mb3dlckNhc2UoKSArICc+JztcbiAgICAgICAgcmV0dXJuIHM7XG4gICAgfVxuICAgIGVsc2UgaWYgKGlzQXJyYXkob2JqKSkge1xuICAgICAgICBpZiAob2JqLmxlbmd0aCA9PT0gMCkgcmV0dXJuICdbXSc7XG4gICAgICAgIHZhciB4cyA9IEFycmF5KG9iai5sZW5ndGgpO1xuICAgICAgICBmb3IgKHZhciBpID0gMDsgaSA8IG9iai5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgeHNbaV0gPSBoYXMob2JqLCBpKSA/IGluc3BlY3Qob2JqW2ldLCBvYmopIDogJyc7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuICdbICcgKyB4cy5qb2luKCcsICcpICsgJyBdJztcbiAgICB9XG4gICAgZWxzZSBpZiAoaXNFcnJvcihvYmopKSB7XG4gICAgICAgIHZhciBwYXJ0cyA9IFtdO1xuICAgICAgICBmb3IgKHZhciBrZXkgaW4gb2JqKSB7XG4gICAgICAgICAgICBpZiAoIWhhcyhvYmosIGtleSkpIGNvbnRpbnVlO1xuICAgICAgICAgICAgXG4gICAgICAgICAgICBpZiAoL1teXFx3JF0vLnRlc3Qoa2V5KSkge1xuICAgICAgICAgICAgICAgIHBhcnRzLnB1c2goaW5zcGVjdChrZXkpICsgJzogJyArIGluc3BlY3Qob2JqW2tleV0pKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgICAgIHBhcnRzLnB1c2goa2V5ICsgJzogJyArIGluc3BlY3Qob2JqW2tleV0pKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICBpZiAocGFydHMubGVuZ3RoID09PSAwKSByZXR1cm4gJ1snICsgb2JqICsgJ10nO1xuICAgICAgICByZXR1cm4gJ3sgWycgKyBvYmogKyAnXSAnICsgcGFydHMuam9pbignLCAnKSArICcgfSc7XG4gICAgfVxuICAgIGVsc2UgaWYgKHR5cGVvZiBvYmogPT09ICdvYmplY3QnICYmIHR5cGVvZiBvYmouaW5zcGVjdCA9PT0gJ2Z1bmN0aW9uJykge1xuICAgICAgICByZXR1cm4gb2JqLmluc3BlY3QoKTtcbiAgICB9XG4gICAgZWxzZSBpZiAodHlwZW9mIG9iaiA9PT0gJ29iamVjdCcgJiYgIWlzRGF0ZShvYmopICYmICFpc1JlZ0V4cChvYmopKSB7XG4gICAgICAgIHZhciB4cyA9IFtdLCBrZXlzID0gW107XG4gICAgICAgIGZvciAodmFyIGtleSBpbiBvYmopIHtcbiAgICAgICAgICAgIGlmIChoYXMob2JqLCBrZXkpKSBrZXlzLnB1c2goa2V5KTtcbiAgICAgICAgfVxuICAgICAgICBrZXlzLnNvcnQoKTtcbiAgICAgICAgZm9yICh2YXIgaSA9IDA7IGkgPCBrZXlzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICB2YXIga2V5ID0ga2V5c1tpXTtcbiAgICAgICAgICAgIGlmICgvW15cXHckXS8udGVzdChrZXkpKSB7XG4gICAgICAgICAgICAgICAgeHMucHVzaChpbnNwZWN0KGtleSkgKyAnOiAnICsgaW5zcGVjdChvYmpba2V5XSwgb2JqKSk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBlbHNlIHhzLnB1c2goa2V5ICsgJzogJyArIGluc3BlY3Qob2JqW2tleV0sIG9iaikpO1xuICAgICAgICB9XG4gICAgICAgIGlmICh4cy5sZW5ndGggPT09IDApIHJldHVybiAne30nO1xuICAgICAgICByZXR1cm4gJ3sgJyArIHhzLmpvaW4oJywgJykgKyAnIH0nO1xuICAgIH1cbiAgICBlbHNlIHJldHVybiBTdHJpbmcob2JqKTtcbn07XG5cbmZ1bmN0aW9uIHF1b3RlIChzKSB7XG4gICAgcmV0dXJuIFN0cmluZyhzKS5yZXBsYWNlKC9cIi9nLCAnJnF1b3Q7Jyk7XG59XG5cbmZ1bmN0aW9uIGlzQXJyYXkgKG9iaikgeyByZXR1cm4gdG9TdHIob2JqKSA9PT0gJ1tvYmplY3QgQXJyYXldJyB9XG5mdW5jdGlvbiBpc0RhdGUgKG9iaikgeyByZXR1cm4gdG9TdHIob2JqKSA9PT0gJ1tvYmplY3QgRGF0ZV0nIH1cbmZ1bmN0aW9uIGlzUmVnRXhwIChvYmopIHsgcmV0dXJuIHRvU3RyKG9iaikgPT09ICdbb2JqZWN0IFJlZ0V4cF0nIH1cbmZ1bmN0aW9uIGlzRXJyb3IgKG9iaikgeyByZXR1cm4gdG9TdHIob2JqKSA9PT0gJ1tvYmplY3QgRXJyb3JdJyB9XG5mdW5jdGlvbiBpc1N5bWJvbCAob2JqKSB7IHJldHVybiB0b1N0cihvYmopID09PSAnW29iamVjdCBTeW1ib2xdJyB9XG5cbnZhciBoYXNPd24gPSBPYmplY3QucHJvdG90eXBlLmhhc093blByb3BlcnR5IHx8IGZ1bmN0aW9uIChrZXkpIHsgcmV0dXJuIGtleSBpbiB0aGlzOyB9O1xuZnVuY3Rpb24gaGFzIChvYmosIGtleSkge1xuICAgIHJldHVybiBoYXNPd24uY2FsbChvYmosIGtleSk7XG59XG5cbmZ1bmN0aW9uIHRvU3RyIChvYmopIHtcbiAgICByZXR1cm4gT2JqZWN0LnByb3RvdHlwZS50b1N0cmluZy5jYWxsKG9iaik7XG59XG5cbmZ1bmN0aW9uIG5hbWVPZiAoZikge1xuICAgIGlmIChmLm5hbWUpIHJldHVybiBmLm5hbWU7XG4gICAgdmFyIG0gPSBmLnRvU3RyaW5nKCkubWF0Y2goL15mdW5jdGlvblxccyooW1xcdyRdKykvKTtcbiAgICBpZiAobSkgcmV0dXJuIG1bMV07XG59XG5cbmZ1bmN0aW9uIGluZGV4T2YgKHhzLCB4KSB7XG4gICAgaWYgKHhzLmluZGV4T2YpIHJldHVybiB4cy5pbmRleE9mKHgpO1xuICAgIGZvciAodmFyIGkgPSAwLCBsID0geHMubGVuZ3RoOyBpIDwgbDsgaSsrKSB7XG4gICAgICAgIGlmICh4c1tpXSA9PT0geCkgcmV0dXJuIGk7XG4gICAgfVxuICAgIHJldHVybiAtMTtcbn1cblxuZnVuY3Rpb24gaXNFbGVtZW50ICh4KSB7XG4gICAgaWYgKCF4IHx8IHR5cGVvZiB4ICE9PSAnb2JqZWN0JykgcmV0dXJuIGZhbHNlO1xuICAgIGlmICh0eXBlb2YgSFRNTEVsZW1lbnQgIT09ICd1bmRlZmluZWQnICYmIHggaW5zdGFuY2VvZiBIVE1MRWxlbWVudCkge1xuICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICB9XG4gICAgcmV0dXJuIHR5cGVvZiB4Lm5vZGVOYW1lID09PSAnc3RyaW5nJ1xuICAgICAgICAmJiB0eXBlb2YgeC5nZXRBdHRyaWJ1dGUgPT09ICdmdW5jdGlvbidcbiAgICA7XG59XG5cbmZ1bmN0aW9uIGluc3BlY3RTdHJpbmcgKHN0cikge1xuICAgIHZhciBzID0gc3RyLnJlcGxhY2UoLyhbJ1xcXFxdKS9nLCAnXFxcXCQxJykucmVwbGFjZSgvW1xceDAwLVxceDFmXS9nLCBsb3dieXRlKTtcbiAgICByZXR1cm4gXCInXCIgKyBzICsgXCInXCI7XG4gICAgXG4gICAgZnVuY3Rpb24gbG93Ynl0ZSAoYykge1xuICAgICAgICB2YXIgbiA9IGMuY2hhckNvZGVBdCgwKTtcbiAgICAgICAgdmFyIHggPSB7IDg6ICdiJywgOTogJ3QnLCAxMDogJ24nLCAxMjogJ2YnLCAxMzogJ3InIH1bbl07XG4gICAgICAgIGlmICh4KSByZXR1cm4gJ1xcXFwnICsgeDtcbiAgICAgICAgcmV0dXJuICdcXFxceCcgKyAobiA8IDB4MTAgPyAnMCcgOiAnJykgKyBuLnRvU3RyaW5nKDE2KTtcbiAgICB9XG59XG4iLCJ2YXIgdGhyb3VnaCA9IHJlcXVpcmUoJ3Rocm91Z2gnKTtcbnZhciBuZXh0VGljayA9IHR5cGVvZiBzZXRJbW1lZGlhdGUgIT09ICd1bmRlZmluZWQnXG4gICAgPyBzZXRJbW1lZGlhdGVcbiAgICA6IHByb2Nlc3MubmV4dFRpY2tcbjtcblxubW9kdWxlLmV4cG9ydHMgPSBmdW5jdGlvbiAod3JpdGUsIGVuZCkge1xuICAgIHZhciB0ciA9IHRocm91Z2god3JpdGUsIGVuZCk7XG4gICAgdHIucGF1c2UoKTtcbiAgICB2YXIgcmVzdW1lID0gdHIucmVzdW1lO1xuICAgIHZhciBwYXVzZSA9IHRyLnBhdXNlO1xuICAgIHZhciBwYXVzZWQgPSBmYWxzZTtcbiAgICBcbiAgICB0ci5wYXVzZSA9IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgcGF1c2VkID0gdHJ1ZTtcbiAgICAgICAgcmV0dXJuIHBhdXNlLmFwcGx5KHRoaXMsIGFyZ3VtZW50cyk7XG4gICAgfTtcbiAgICBcbiAgICB0ci5yZXN1bWUgPSBmdW5jdGlvbiAoKSB7XG4gICAgICAgIHBhdXNlZCA9IGZhbHNlO1xuICAgICAgICByZXR1cm4gcmVzdW1lLmFwcGx5KHRoaXMsIGFyZ3VtZW50cyk7XG4gICAgfTtcbiAgICBcbiAgICBuZXh0VGljayhmdW5jdGlvbiAoKSB7XG4gICAgICAgIGlmICghcGF1c2VkKSB0ci5yZXN1bWUoKTtcbiAgICB9KTtcbiAgICBcbiAgICByZXR1cm4gdHI7XG59O1xuIiwiJ3VzZSBzdHJpY3QnO1xuXG52YXIgYmluZCA9IHJlcXVpcmUoJ2Z1bmN0aW9uLWJpbmQnKTtcbnZhciBFUyA9IHJlcXVpcmUoJ2VzLWFic3RyYWN0L2VzNScpO1xudmFyIHJlcGxhY2UgPSBiaW5kLmNhbGwoRnVuY3Rpb24uY2FsbCwgU3RyaW5nLnByb3RvdHlwZS5yZXBsYWNlKTtcblxudmFyIGxlZnRXaGl0ZXNwYWNlID0gL15bXFx4MDlcXHgwQVxceDBCXFx4MENcXHgwRFxceDIwXFx4QTBcXHUxNjgwXFx1MTgwRVxcdTIwMDBcXHUyMDAxXFx1MjAwMlxcdTIwMDNcXHUyMDA0XFx1MjAwNVxcdTIwMDZcXHUyMDA3XFx1MjAwOFxcdTIwMDlcXHUyMDBBXFx1MjAyRlxcdTIwNUZcXHUzMDAwXFx1MjAyOFxcdTIwMjlcXHVGRUZGXSsvO1xudmFyIHJpZ2h0V2hpdGVzcGFjZSA9IC9bXFx4MDlcXHgwQVxceDBCXFx4MENcXHgwRFxceDIwXFx4QTBcXHUxNjgwXFx1MTgwRVxcdTIwMDBcXHUyMDAxXFx1MjAwMlxcdTIwMDNcXHUyMDA0XFx1MjAwNVxcdTIwMDZcXHUyMDA3XFx1MjAwOFxcdTIwMDlcXHUyMDBBXFx1MjAyRlxcdTIwNUZcXHUzMDAwXFx1MjAyOFxcdTIwMjlcXHVGRUZGXSskLztcblxubW9kdWxlLmV4cG9ydHMgPSBmdW5jdGlvbiB0cmltKCkge1xuXHR2YXIgUyA9IEVTLlRvU3RyaW5nKEVTLkNoZWNrT2JqZWN0Q29lcmNpYmxlKHRoaXMpKTtcblx0cmV0dXJuIHJlcGxhY2UocmVwbGFjZShTLCBsZWZ0V2hpdGVzcGFjZSwgJycpLCByaWdodFdoaXRlc3BhY2UsICcnKTtcbn07XG4iLCIndXNlIHN0cmljdCc7XG5cbnZhciBiaW5kID0gcmVxdWlyZSgnZnVuY3Rpb24tYmluZCcpO1xudmFyIGRlZmluZSA9IHJlcXVpcmUoJ2RlZmluZS1wcm9wZXJ0aWVzJyk7XG5cbnZhciBpbXBsZW1lbnRhdGlvbiA9IHJlcXVpcmUoJy4vaW1wbGVtZW50YXRpb24nKTtcbnZhciBnZXRQb2x5ZmlsbCA9IHJlcXVpcmUoJy4vcG9seWZpbGwnKTtcbnZhciBzaGltID0gcmVxdWlyZSgnLi9zaGltJyk7XG5cbnZhciBib3VuZFRyaW0gPSBiaW5kLmNhbGwoRnVuY3Rpb24uY2FsbCwgaW1wbGVtZW50YXRpb24pO1xuXG5kZWZpbmUoYm91bmRUcmltLCB7XG5cdGdldFBvbHlmaWxsOiBnZXRQb2x5ZmlsbCxcblx0aW1wbGVtZW50YXRpb246IGltcGxlbWVudGF0aW9uLFxuXHRzaGltOiBzaGltXG59KTtcblxubW9kdWxlLmV4cG9ydHMgPSBib3VuZFRyaW07XG4iLCIndXNlIHN0cmljdCc7XG5cbnZhciBrZXlzID0gcmVxdWlyZSgnb2JqZWN0LWtleXMnKTtcbnZhciBmb3JlYWNoID0gcmVxdWlyZSgnZm9yZWFjaCcpO1xudmFyIGhhc1N5bWJvbHMgPSB0eXBlb2YgU3ltYm9sID09PSAnZnVuY3Rpb24nICYmIHR5cGVvZiBTeW1ib2woKSA9PT0gJ3N5bWJvbCc7XG5cbnZhciB0b1N0ciA9IE9iamVjdC5wcm90b3R5cGUudG9TdHJpbmc7XG5cbnZhciBpc0Z1bmN0aW9uID0gZnVuY3Rpb24gKGZuKSB7XG5cdHJldHVybiB0eXBlb2YgZm4gPT09ICdmdW5jdGlvbicgJiYgdG9TdHIuY2FsbChmbikgPT09ICdbb2JqZWN0IEZ1bmN0aW9uXSc7XG59O1xuXG52YXIgYXJlUHJvcGVydHlEZXNjcmlwdG9yc1N1cHBvcnRlZCA9IGZ1bmN0aW9uICgpIHtcblx0dmFyIG9iaiA9IHt9O1xuXHR0cnkge1xuXHRcdE9iamVjdC5kZWZpbmVQcm9wZXJ0eShvYmosICd4JywgeyBlbnVtZXJhYmxlOiBmYWxzZSwgdmFsdWU6IG9iaiB9KTtcbiAgICAgICAgLyogZXNsaW50LWRpc2FibGUgbm8tdW51c2VkLXZhcnMsIG5vLXJlc3RyaWN0ZWQtc3ludGF4ICovXG4gICAgICAgIGZvciAodmFyIF8gaW4gb2JqKSB7IHJldHVybiBmYWxzZTsgfVxuICAgICAgICAvKiBlc2xpbnQtZW5hYmxlIG5vLXVudXNlZC12YXJzLCBuby1yZXN0cmljdGVkLXN5bnRheCAqL1xuXHRcdHJldHVybiBvYmoueCA9PT0gb2JqO1xuXHR9IGNhdGNoIChlKSB7IC8qIHRoaXMgaXMgSUUgOC4gKi9cblx0XHRyZXR1cm4gZmFsc2U7XG5cdH1cbn07XG52YXIgc3VwcG9ydHNEZXNjcmlwdG9ycyA9IE9iamVjdC5kZWZpbmVQcm9wZXJ0eSAmJiBhcmVQcm9wZXJ0eURlc2NyaXB0b3JzU3VwcG9ydGVkKCk7XG5cbnZhciBkZWZpbmVQcm9wZXJ0eSA9IGZ1bmN0aW9uIChvYmplY3QsIG5hbWUsIHZhbHVlLCBwcmVkaWNhdGUpIHtcblx0aWYgKG5hbWUgaW4gb2JqZWN0ICYmICghaXNGdW5jdGlvbihwcmVkaWNhdGUpIHx8ICFwcmVkaWNhdGUoKSkpIHtcblx0XHRyZXR1cm47XG5cdH1cblx0aWYgKHN1cHBvcnRzRGVzY3JpcHRvcnMpIHtcblx0XHRPYmplY3QuZGVmaW5lUHJvcGVydHkob2JqZWN0LCBuYW1lLCB7XG5cdFx0XHRjb25maWd1cmFibGU6IHRydWUsXG5cdFx0XHRlbnVtZXJhYmxlOiBmYWxzZSxcblx0XHRcdHZhbHVlOiB2YWx1ZSxcblx0XHRcdHdyaXRhYmxlOiB0cnVlXG5cdFx0fSk7XG5cdH0gZWxzZSB7XG5cdFx0b2JqZWN0W25hbWVdID0gdmFsdWU7XG5cdH1cbn07XG5cbnZhciBkZWZpbmVQcm9wZXJ0aWVzID0gZnVuY3Rpb24gKG9iamVjdCwgbWFwKSB7XG5cdHZhciBwcmVkaWNhdGVzID0gYXJndW1lbnRzLmxlbmd0aCA+IDIgPyBhcmd1bWVudHNbMl0gOiB7fTtcblx0dmFyIHByb3BzID0ga2V5cyhtYXApO1xuXHRpZiAoaGFzU3ltYm9scykge1xuXHRcdHByb3BzID0gcHJvcHMuY29uY2F0KE9iamVjdC5nZXRPd25Qcm9wZXJ0eVN5bWJvbHMobWFwKSk7XG5cdH1cblx0Zm9yZWFjaChwcm9wcywgZnVuY3Rpb24gKG5hbWUpIHtcblx0XHRkZWZpbmVQcm9wZXJ0eShvYmplY3QsIG5hbWUsIG1hcFtuYW1lXSwgcHJlZGljYXRlc1tuYW1lXSk7XG5cdH0pO1xufTtcblxuZGVmaW5lUHJvcGVydGllcy5zdXBwb3J0c0Rlc2NyaXB0b3JzID0gISFzdXBwb3J0c0Rlc2NyaXB0b3JzO1xuXG5tb2R1bGUuZXhwb3J0cyA9IGRlZmluZVByb3BlcnRpZXM7XG4iLCJcbnZhciBoYXNPd24gPSBPYmplY3QucHJvdG90eXBlLmhhc093blByb3BlcnR5O1xudmFyIHRvU3RyaW5nID0gT2JqZWN0LnByb3RvdHlwZS50b1N0cmluZztcblxubW9kdWxlLmV4cG9ydHMgPSBmdW5jdGlvbiBmb3JFYWNoIChvYmosIGZuLCBjdHgpIHtcbiAgICBpZiAodG9TdHJpbmcuY2FsbChmbikgIT09ICdbb2JqZWN0IEZ1bmN0aW9uXScpIHtcbiAgICAgICAgdGhyb3cgbmV3IFR5cGVFcnJvcignaXRlcmF0b3IgbXVzdCBiZSBhIGZ1bmN0aW9uJyk7XG4gICAgfVxuICAgIHZhciBsID0gb2JqLmxlbmd0aDtcbiAgICBpZiAobCA9PT0gK2wpIHtcbiAgICAgICAgZm9yICh2YXIgaSA9IDA7IGkgPCBsOyBpKyspIHtcbiAgICAgICAgICAgIGZuLmNhbGwoY3R4LCBvYmpbaV0sIGksIG9iaik7XG4gICAgICAgIH1cbiAgICB9IGVsc2Uge1xuICAgICAgICBmb3IgKHZhciBrIGluIG9iaikge1xuICAgICAgICAgICAgaWYgKGhhc093bi5jYWxsKG9iaiwgaykpIHtcbiAgICAgICAgICAgICAgICBmbi5jYWxsKGN0eCwgb2JqW2tdLCBrLCBvYmopO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfVxufTtcblxuIiwiJ3VzZSBzdHJpY3QnO1xuXG4vLyBtb2RpZmllZCBmcm9tIGh0dHBzOi8vZ2l0aHViLmNvbS9lcy1zaGltcy9lczUtc2hpbVxudmFyIGhhcyA9IE9iamVjdC5wcm90b3R5cGUuaGFzT3duUHJvcGVydHk7XG52YXIgdG9TdHIgPSBPYmplY3QucHJvdG90eXBlLnRvU3RyaW5nO1xudmFyIHNsaWNlID0gQXJyYXkucHJvdG90eXBlLnNsaWNlO1xudmFyIGlzQXJncyA9IHJlcXVpcmUoJy4vaXNBcmd1bWVudHMnKTtcbnZhciBoYXNEb250RW51bUJ1ZyA9ICEoeyB0b1N0cmluZzogbnVsbCB9KS5wcm9wZXJ0eUlzRW51bWVyYWJsZSgndG9TdHJpbmcnKTtcbnZhciBoYXNQcm90b0VudW1CdWcgPSBmdW5jdGlvbiAoKSB7fS5wcm9wZXJ0eUlzRW51bWVyYWJsZSgncHJvdG90eXBlJyk7XG52YXIgZG9udEVudW1zID0gW1xuXHQndG9TdHJpbmcnLFxuXHQndG9Mb2NhbGVTdHJpbmcnLFxuXHQndmFsdWVPZicsXG5cdCdoYXNPd25Qcm9wZXJ0eScsXG5cdCdpc1Byb3RvdHlwZU9mJyxcblx0J3Byb3BlcnR5SXNFbnVtZXJhYmxlJyxcblx0J2NvbnN0cnVjdG9yJ1xuXTtcbnZhciBlcXVhbHNDb25zdHJ1Y3RvclByb3RvdHlwZSA9IGZ1bmN0aW9uIChvKSB7XG5cdHZhciBjdG9yID0gby5jb25zdHJ1Y3Rvcjtcblx0cmV0dXJuIGN0b3IgJiYgY3Rvci5wcm90b3R5cGUgPT09IG87XG59O1xudmFyIGJsYWNrbGlzdGVkS2V5cyA9IHtcblx0JGNvbnNvbGU6IHRydWUsXG5cdCRmcmFtZTogdHJ1ZSxcblx0JGZyYW1lRWxlbWVudDogdHJ1ZSxcblx0JGZyYW1lczogdHJ1ZSxcblx0JHBhcmVudDogdHJ1ZSxcblx0JHNlbGY6IHRydWUsXG5cdCR3ZWJraXRJbmRleGVkREI6IHRydWUsXG5cdCR3ZWJraXRTdG9yYWdlSW5mbzogdHJ1ZSxcblx0JHdpbmRvdzogdHJ1ZVxufTtcbnZhciBoYXNBdXRvbWF0aW9uRXF1YWxpdHlCdWcgPSAoZnVuY3Rpb24gKCkge1xuXHQvKiBnbG9iYWwgd2luZG93ICovXG5cdGlmICh0eXBlb2Ygd2luZG93ID09PSAndW5kZWZpbmVkJykgeyByZXR1cm4gZmFsc2U7IH1cblx0Zm9yICh2YXIgayBpbiB3aW5kb3cpIHtcblx0XHR0cnkge1xuXHRcdFx0aWYgKCFibGFja2xpc3RlZEtleXNbJyQnICsga10gJiYgaGFzLmNhbGwod2luZG93LCBrKSAmJiB3aW5kb3dba10gIT09IG51bGwgJiYgdHlwZW9mIHdpbmRvd1trXSA9PT0gJ29iamVjdCcpIHtcblx0XHRcdFx0dHJ5IHtcblx0XHRcdFx0XHRlcXVhbHNDb25zdHJ1Y3RvclByb3RvdHlwZSh3aW5kb3dba10pO1xuXHRcdFx0XHR9IGNhdGNoIChlKSB7XG5cdFx0XHRcdFx0cmV0dXJuIHRydWU7XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHR9IGNhdGNoIChlKSB7XG5cdFx0XHRyZXR1cm4gdHJ1ZTtcblx0XHR9XG5cdH1cblx0cmV0dXJuIGZhbHNlO1xufSgpKTtcbnZhciBlcXVhbHNDb25zdHJ1Y3RvclByb3RvdHlwZUlmTm90QnVnZ3kgPSBmdW5jdGlvbiAobykge1xuXHQvKiBnbG9iYWwgd2luZG93ICovXG5cdGlmICh0eXBlb2Ygd2luZG93ID09PSAndW5kZWZpbmVkJyB8fCAhaGFzQXV0b21hdGlvbkVxdWFsaXR5QnVnKSB7XG5cdFx0cmV0dXJuIGVxdWFsc0NvbnN0cnVjdG9yUHJvdG90eXBlKG8pO1xuXHR9XG5cdHRyeSB7XG5cdFx0cmV0dXJuIGVxdWFsc0NvbnN0cnVjdG9yUHJvdG90eXBlKG8pO1xuXHR9IGNhdGNoIChlKSB7XG5cdFx0cmV0dXJuIGZhbHNlO1xuXHR9XG59O1xuXG52YXIga2V5c1NoaW0gPSBmdW5jdGlvbiBrZXlzKG9iamVjdCkge1xuXHR2YXIgaXNPYmplY3QgPSBvYmplY3QgIT09IG51bGwgJiYgdHlwZW9mIG9iamVjdCA9PT0gJ29iamVjdCc7XG5cdHZhciBpc0Z1bmN0aW9uID0gdG9TdHIuY2FsbChvYmplY3QpID09PSAnW29iamVjdCBGdW5jdGlvbl0nO1xuXHR2YXIgaXNBcmd1bWVudHMgPSBpc0FyZ3Mob2JqZWN0KTtcblx0dmFyIGlzU3RyaW5nID0gaXNPYmplY3QgJiYgdG9TdHIuY2FsbChvYmplY3QpID09PSAnW29iamVjdCBTdHJpbmddJztcblx0dmFyIHRoZUtleXMgPSBbXTtcblxuXHRpZiAoIWlzT2JqZWN0ICYmICFpc0Z1bmN0aW9uICYmICFpc0FyZ3VtZW50cykge1xuXHRcdHRocm93IG5ldyBUeXBlRXJyb3IoJ09iamVjdC5rZXlzIGNhbGxlZCBvbiBhIG5vbi1vYmplY3QnKTtcblx0fVxuXG5cdHZhciBza2lwUHJvdG8gPSBoYXNQcm90b0VudW1CdWcgJiYgaXNGdW5jdGlvbjtcblx0aWYgKGlzU3RyaW5nICYmIG9iamVjdC5sZW5ndGggPiAwICYmICFoYXMuY2FsbChvYmplY3QsIDApKSB7XG5cdFx0Zm9yICh2YXIgaSA9IDA7IGkgPCBvYmplY3QubGVuZ3RoOyArK2kpIHtcblx0XHRcdHRoZUtleXMucHVzaChTdHJpbmcoaSkpO1xuXHRcdH1cblx0fVxuXG5cdGlmIChpc0FyZ3VtZW50cyAmJiBvYmplY3QubGVuZ3RoID4gMCkge1xuXHRcdGZvciAodmFyIGogPSAwOyBqIDwgb2JqZWN0Lmxlbmd0aDsgKytqKSB7XG5cdFx0XHR0aGVLZXlzLnB1c2goU3RyaW5nKGopKTtcblx0XHR9XG5cdH0gZWxzZSB7XG5cdFx0Zm9yICh2YXIgbmFtZSBpbiBvYmplY3QpIHtcblx0XHRcdGlmICghKHNraXBQcm90byAmJiBuYW1lID09PSAncHJvdG90eXBlJykgJiYgaGFzLmNhbGwob2JqZWN0LCBuYW1lKSkge1xuXHRcdFx0XHR0aGVLZXlzLnB1c2goU3RyaW5nKG5hbWUpKTtcblx0XHRcdH1cblx0XHR9XG5cdH1cblxuXHRpZiAoaGFzRG9udEVudW1CdWcpIHtcblx0XHR2YXIgc2tpcENvbnN0cnVjdG9yID0gZXF1YWxzQ29uc3RydWN0b3JQcm90b3R5cGVJZk5vdEJ1Z2d5KG9iamVjdCk7XG5cblx0XHRmb3IgKHZhciBrID0gMDsgayA8IGRvbnRFbnVtcy5sZW5ndGg7ICsraykge1xuXHRcdFx0aWYgKCEoc2tpcENvbnN0cnVjdG9yICYmIGRvbnRFbnVtc1trXSA9PT0gJ2NvbnN0cnVjdG9yJykgJiYgaGFzLmNhbGwob2JqZWN0LCBkb250RW51bXNba10pKSB7XG5cdFx0XHRcdHRoZUtleXMucHVzaChkb250RW51bXNba10pO1xuXHRcdFx0fVxuXHRcdH1cblx0fVxuXHRyZXR1cm4gdGhlS2V5cztcbn07XG5cbmtleXNTaGltLnNoaW0gPSBmdW5jdGlvbiBzaGltT2JqZWN0S2V5cygpIHtcblx0aWYgKE9iamVjdC5rZXlzKSB7XG5cdFx0dmFyIGtleXNXb3Jrc1dpdGhBcmd1bWVudHMgPSAoZnVuY3Rpb24gKCkge1xuXHRcdFx0Ly8gU2FmYXJpIDUuMCBidWdcblx0XHRcdHJldHVybiAoT2JqZWN0LmtleXMoYXJndW1lbnRzKSB8fCAnJykubGVuZ3RoID09PSAyO1xuXHRcdH0oMSwgMikpO1xuXHRcdGlmICgha2V5c1dvcmtzV2l0aEFyZ3VtZW50cykge1xuXHRcdFx0dmFyIG9yaWdpbmFsS2V5cyA9IE9iamVjdC5rZXlzO1xuXHRcdFx0T2JqZWN0LmtleXMgPSBmdW5jdGlvbiBrZXlzKG9iamVjdCkge1xuXHRcdFx0XHRpZiAoaXNBcmdzKG9iamVjdCkpIHtcblx0XHRcdFx0XHRyZXR1cm4gb3JpZ2luYWxLZXlzKHNsaWNlLmNhbGwob2JqZWN0KSk7XG5cdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0cmV0dXJuIG9yaWdpbmFsS2V5cyhvYmplY3QpO1xuXHRcdFx0XHR9XG5cdFx0XHR9O1xuXHRcdH1cblx0fSBlbHNlIHtcblx0XHRPYmplY3Qua2V5cyA9IGtleXNTaGltO1xuXHR9XG5cdHJldHVybiBPYmplY3Qua2V5cyB8fCBrZXlzU2hpbTtcbn07XG5cbm1vZHVsZS5leHBvcnRzID0ga2V5c1NoaW07XG4iLCIndXNlIHN0cmljdCc7XG5cbnZhciB0b1N0ciA9IE9iamVjdC5wcm90b3R5cGUudG9TdHJpbmc7XG5cbm1vZHVsZS5leHBvcnRzID0gZnVuY3Rpb24gaXNBcmd1bWVudHModmFsdWUpIHtcblx0dmFyIHN0ciA9IHRvU3RyLmNhbGwodmFsdWUpO1xuXHR2YXIgaXNBcmdzID0gc3RyID09PSAnW29iamVjdCBBcmd1bWVudHNdJztcblx0aWYgKCFpc0FyZ3MpIHtcblx0XHRpc0FyZ3MgPSBzdHIgIT09ICdbb2JqZWN0IEFycmF5XScgJiZcblx0XHRcdHZhbHVlICE9PSBudWxsICYmXG5cdFx0XHR0eXBlb2YgdmFsdWUgPT09ICdvYmplY3QnICYmXG5cdFx0XHR0eXBlb2YgdmFsdWUubGVuZ3RoID09PSAnbnVtYmVyJyAmJlxuXHRcdFx0dmFsdWUubGVuZ3RoID49IDAgJiZcblx0XHRcdHRvU3RyLmNhbGwodmFsdWUuY2FsbGVlKSA9PT0gJ1tvYmplY3QgRnVuY3Rpb25dJztcblx0fVxuXHRyZXR1cm4gaXNBcmdzO1xufTtcbiIsIid1c2Ugc3RyaWN0JztcblxudmFyICRpc05hTiA9IE51bWJlci5pc05hTiB8fCBmdW5jdGlvbiAoYSkgeyByZXR1cm4gYSAhPT0gYTsgfTtcbnZhciAkaXNGaW5pdGUgPSByZXF1aXJlKCcuL2hlbHBlcnMvaXNGaW5pdGUnKTtcblxudmFyIHNpZ24gPSByZXF1aXJlKCcuL2hlbHBlcnMvc2lnbicpO1xudmFyIG1vZCA9IHJlcXVpcmUoJy4vaGVscGVycy9tb2QnKTtcblxudmFyIElzQ2FsbGFibGUgPSByZXF1aXJlKCdpcy1jYWxsYWJsZScpO1xudmFyIHRvUHJpbWl0aXZlID0gcmVxdWlyZSgnZXMtdG8tcHJpbWl0aXZlL2VzNScpO1xuXG4vLyBodHRwczovL2VzNS5naXRodWIuaW8vI3g5XG52YXIgRVM1ID0ge1xuXHRUb1ByaW1pdGl2ZTogdG9QcmltaXRpdmUsXG5cblx0VG9Cb29sZWFuOiBmdW5jdGlvbiBUb0Jvb2xlYW4odmFsdWUpIHtcblx0XHRyZXR1cm4gQm9vbGVhbih2YWx1ZSk7XG5cdH0sXG5cdFRvTnVtYmVyOiBmdW5jdGlvbiBUb051bWJlcih2YWx1ZSkge1xuXHRcdHJldHVybiBOdW1iZXIodmFsdWUpO1xuXHR9LFxuXHRUb0ludGVnZXI6IGZ1bmN0aW9uIFRvSW50ZWdlcih2YWx1ZSkge1xuXHRcdHZhciBudW1iZXIgPSB0aGlzLlRvTnVtYmVyKHZhbHVlKTtcblx0XHRpZiAoJGlzTmFOKG51bWJlcikpIHsgcmV0dXJuIDA7IH1cblx0XHRpZiAobnVtYmVyID09PSAwIHx8ICEkaXNGaW5pdGUobnVtYmVyKSkgeyByZXR1cm4gbnVtYmVyOyB9XG5cdFx0cmV0dXJuIHNpZ24obnVtYmVyKSAqIE1hdGguZmxvb3IoTWF0aC5hYnMobnVtYmVyKSk7XG5cdH0sXG5cdFRvSW50MzI6IGZ1bmN0aW9uIFRvSW50MzIoeCkge1xuXHRcdHJldHVybiB0aGlzLlRvTnVtYmVyKHgpID4+IDA7XG5cdH0sXG5cdFRvVWludDMyOiBmdW5jdGlvbiBUb1VpbnQzMih4KSB7XG5cdFx0cmV0dXJuIHRoaXMuVG9OdW1iZXIoeCkgPj4+IDA7XG5cdH0sXG5cdFRvVWludDE2OiBmdW5jdGlvbiBUb1VpbnQxNih2YWx1ZSkge1xuXHRcdHZhciBudW1iZXIgPSB0aGlzLlRvTnVtYmVyKHZhbHVlKTtcblx0XHRpZiAoJGlzTmFOKG51bWJlcikgfHwgbnVtYmVyID09PSAwIHx8ICEkaXNGaW5pdGUobnVtYmVyKSkgeyByZXR1cm4gMDsgfVxuXHRcdHZhciBwb3NJbnQgPSBzaWduKG51bWJlcikgKiBNYXRoLmZsb29yKE1hdGguYWJzKG51bWJlcikpO1xuXHRcdHJldHVybiBtb2QocG9zSW50LCAweDEwMDAwKTtcblx0fSxcblx0VG9TdHJpbmc6IGZ1bmN0aW9uIFRvU3RyaW5nKHZhbHVlKSB7XG5cdFx0cmV0dXJuIFN0cmluZyh2YWx1ZSk7XG5cdH0sXG5cdFRvT2JqZWN0OiBmdW5jdGlvbiBUb09iamVjdCh2YWx1ZSkge1xuXHRcdHRoaXMuQ2hlY2tPYmplY3RDb2VyY2libGUodmFsdWUpO1xuXHRcdHJldHVybiBPYmplY3QodmFsdWUpO1xuXHR9LFxuXHRDaGVja09iamVjdENvZXJjaWJsZTogZnVuY3Rpb24gQ2hlY2tPYmplY3RDb2VyY2libGUodmFsdWUsIG9wdE1lc3NhZ2UpIHtcblx0XHQvKiBqc2hpbnQgZXFudWxsOnRydWUgKi9cblx0XHRpZiAodmFsdWUgPT0gbnVsbCkge1xuXHRcdFx0dGhyb3cgbmV3IFR5cGVFcnJvcihvcHRNZXNzYWdlIHx8ICdDYW5ub3QgY2FsbCBtZXRob2Qgb24gJyArIHZhbHVlKTtcblx0XHR9XG5cdFx0cmV0dXJuIHZhbHVlO1xuXHR9LFxuXHRJc0NhbGxhYmxlOiBJc0NhbGxhYmxlLFxuXHRTYW1lVmFsdWU6IGZ1bmN0aW9uIFNhbWVWYWx1ZSh4LCB5KSB7XG5cdFx0aWYgKHggPT09IHkpIHsgLy8gMCA9PT0gLTAsIGJ1dCB0aGV5IGFyZSBub3QgaWRlbnRpY2FsLlxuXHRcdFx0aWYgKHggPT09IDApIHsgcmV0dXJuIDEgLyB4ID09PSAxIC8geTsgfVxuXHRcdFx0cmV0dXJuIHRydWU7XG5cdFx0fVxuICAgICAgICByZXR1cm4gJGlzTmFOKHgpICYmICRpc05hTih5KTtcblx0fVxufTtcblxubW9kdWxlLmV4cG9ydHMgPSBFUzU7XG4iLCJ2YXIgJGlzTmFOID0gTnVtYmVyLmlzTmFOIHx8IGZ1bmN0aW9uIChhKSB7IHJldHVybiBhICE9PSBhOyB9O1xuXG5tb2R1bGUuZXhwb3J0cyA9IE51bWJlci5pc0Zpbml0ZSB8fCBmdW5jdGlvbiAoeCkgeyByZXR1cm4gdHlwZW9mIHggPT09ICdudW1iZXInICYmICEkaXNOYU4oeCkgJiYgeCAhPT0gSW5maW5pdHkgJiYgeCAhPT0gLUluZmluaXR5OyB9O1xuIiwibW9kdWxlLmV4cG9ydHMgPSBmdW5jdGlvbiBtb2QobnVtYmVyLCBtb2R1bG8pIHtcblx0dmFyIHJlbWFpbiA9IG51bWJlciAlIG1vZHVsbztcblx0cmV0dXJuIE1hdGguZmxvb3IocmVtYWluID49IDAgPyByZW1haW4gOiByZW1haW4gKyBtb2R1bG8pO1xufTtcbiIsIm1vZHVsZS5leHBvcnRzID0gZnVuY3Rpb24gc2lnbihudW1iZXIpIHtcblx0cmV0dXJuIG51bWJlciA+PSAwID8gMSA6IC0xO1xufTtcbiIsIid1c2Ugc3RyaWN0JztcblxudmFyIHRvU3RyID0gT2JqZWN0LnByb3RvdHlwZS50b1N0cmluZztcblxudmFyIGlzUHJpbWl0aXZlID0gcmVxdWlyZSgnLi9oZWxwZXJzL2lzUHJpbWl0aXZlJyk7XG5cbnZhciBpc0NhbGxhYmxlID0gcmVxdWlyZSgnaXMtY2FsbGFibGUnKTtcblxuLy8gaHR0cHM6Ly9lczUuZ2l0aHViLmlvLyN4OC4xMlxudmFyIEVTNWludGVybmFsU2xvdHMgPSB7XG5cdCdbW0RlZmF1bHRWYWx1ZV1dJzogZnVuY3Rpb24gKE8sIGhpbnQpIHtcblx0XHR2YXIgYWN0dWFsSGludCA9IGhpbnQgfHwgKHRvU3RyLmNhbGwoTykgPT09ICdbb2JqZWN0IERhdGVdJyA/IFN0cmluZyA6IE51bWJlcik7XG5cblx0XHRpZiAoYWN0dWFsSGludCA9PT0gU3RyaW5nIHx8IGFjdHVhbEhpbnQgPT09IE51bWJlcikge1xuXHRcdFx0dmFyIG1ldGhvZHMgPSBhY3R1YWxIaW50ID09PSBTdHJpbmcgPyBbJ3RvU3RyaW5nJywgJ3ZhbHVlT2YnXSA6IFsndmFsdWVPZicsICd0b1N0cmluZyddO1xuXHRcdFx0dmFyIHZhbHVlLCBpO1xuXHRcdFx0Zm9yIChpID0gMDsgaSA8IG1ldGhvZHMubGVuZ3RoOyArK2kpIHtcblx0XHRcdFx0aWYgKGlzQ2FsbGFibGUoT1ttZXRob2RzW2ldXSkpIHtcblx0XHRcdFx0XHR2YWx1ZSA9IE9bbWV0aG9kc1tpXV0oKTtcblx0XHRcdFx0XHRpZiAoaXNQcmltaXRpdmUodmFsdWUpKSB7XG5cdFx0XHRcdFx0XHRyZXR1cm4gdmFsdWU7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0XHR0aHJvdyBuZXcgVHlwZUVycm9yKCdObyBkZWZhdWx0IHZhbHVlJyk7XG5cdFx0fVxuXHRcdHRocm93IG5ldyBUeXBlRXJyb3IoJ2ludmFsaWQgW1tEZWZhdWx0VmFsdWVdXSBoaW50IHN1cHBsaWVkJyk7XG5cdH1cbn07XG5cbi8vIGh0dHBzOi8vZXM1LmdpdGh1Yi5pby8jeDlcbm1vZHVsZS5leHBvcnRzID0gZnVuY3Rpb24gVG9QcmltaXRpdmUoaW5wdXQsIFByZWZlcnJlZFR5cGUpIHtcblx0aWYgKGlzUHJpbWl0aXZlKGlucHV0KSkge1xuXHRcdHJldHVybiBpbnB1dDtcblx0fVxuXHRyZXR1cm4gRVM1aW50ZXJuYWxTbG90c1snW1tEZWZhdWx0VmFsdWVdXSddKGlucHV0LCBQcmVmZXJyZWRUeXBlKTtcbn07XG4iLCJtb2R1bGUuZXhwb3J0cyA9IGZ1bmN0aW9uIGlzUHJpbWl0aXZlKHZhbHVlKSB7XG5cdHJldHVybiB2YWx1ZSA9PT0gbnVsbCB8fCAodHlwZW9mIHZhbHVlICE9PSAnZnVuY3Rpb24nICYmIHR5cGVvZiB2YWx1ZSAhPT0gJ29iamVjdCcpO1xufTtcbiIsIid1c2Ugc3RyaWN0JztcblxudmFyIGZuVG9TdHIgPSBGdW5jdGlvbi5wcm90b3R5cGUudG9TdHJpbmc7XG5cbnZhciBjb25zdHJ1Y3RvclJlZ2V4ID0gL1xccypjbGFzcyAvO1xudmFyIGlzRVM2Q2xhc3NGbiA9IGZ1bmN0aW9uIGlzRVM2Q2xhc3NGbih2YWx1ZSkge1xuXHR0cnkge1xuXHRcdHZhciBmblN0ciA9IGZuVG9TdHIuY2FsbCh2YWx1ZSk7XG5cdFx0dmFyIHNpbmdsZVN0cmlwcGVkID0gZm5TdHIucmVwbGFjZSgvXFwvXFwvLipcXG4vZywgJycpO1xuXHRcdHZhciBtdWx0aVN0cmlwcGVkID0gc2luZ2xlU3RyaXBwZWQucmVwbGFjZSgvXFwvXFwqWy5cXHNcXFNdKlxcKlxcLy9nLCAnJyk7XG5cdFx0dmFyIHNwYWNlU3RyaXBwZWQgPSBtdWx0aVN0cmlwcGVkLnJlcGxhY2UoL1xcbi9tZywgJyAnKS5yZXBsYWNlKC8gezJ9L2csICcgJyk7XG5cdFx0cmV0dXJuIGNvbnN0cnVjdG9yUmVnZXgudGVzdChzcGFjZVN0cmlwcGVkKTtcblx0fSBjYXRjaCAoZSkge1xuXHRcdHJldHVybiBmYWxzZTsgLy8gbm90IGEgZnVuY3Rpb25cblx0fVxufTtcblxudmFyIHRyeUZ1bmN0aW9uT2JqZWN0ID0gZnVuY3Rpb24gdHJ5RnVuY3Rpb25PYmplY3QodmFsdWUpIHtcblx0dHJ5IHtcblx0XHRpZiAoaXNFUzZDbGFzc0ZuKHZhbHVlKSkgeyByZXR1cm4gZmFsc2U7IH1cblx0XHRmblRvU3RyLmNhbGwodmFsdWUpO1xuXHRcdHJldHVybiB0cnVlO1xuXHR9IGNhdGNoIChlKSB7XG5cdFx0cmV0dXJuIGZhbHNlO1xuXHR9XG59O1xudmFyIHRvU3RyID0gT2JqZWN0LnByb3RvdHlwZS50b1N0cmluZztcbnZhciBmbkNsYXNzID0gJ1tvYmplY3QgRnVuY3Rpb25dJztcbnZhciBnZW5DbGFzcyA9ICdbb2JqZWN0IEdlbmVyYXRvckZ1bmN0aW9uXSc7XG52YXIgaGFzVG9TdHJpbmdUYWcgPSB0eXBlb2YgU3ltYm9sID09PSAnZnVuY3Rpb24nICYmIHR5cGVvZiBTeW1ib2wudG9TdHJpbmdUYWcgPT09ICdzeW1ib2wnO1xuXG5tb2R1bGUuZXhwb3J0cyA9IGZ1bmN0aW9uIGlzQ2FsbGFibGUodmFsdWUpIHtcblx0aWYgKCF2YWx1ZSkgeyByZXR1cm4gZmFsc2U7IH1cblx0aWYgKHR5cGVvZiB2YWx1ZSAhPT0gJ2Z1bmN0aW9uJyAmJiB0eXBlb2YgdmFsdWUgIT09ICdvYmplY3QnKSB7IHJldHVybiBmYWxzZTsgfVxuXHRpZiAoaGFzVG9TdHJpbmdUYWcpIHsgcmV0dXJuIHRyeUZ1bmN0aW9uT2JqZWN0KHZhbHVlKTsgfVxuXHRpZiAoaXNFUzZDbGFzc0ZuKHZhbHVlKSkgeyByZXR1cm4gZmFsc2U7IH1cblx0dmFyIHN0ckNsYXNzID0gdG9TdHIuY2FsbCh2YWx1ZSk7XG5cdHJldHVybiBzdHJDbGFzcyA9PT0gZm5DbGFzcyB8fCBzdHJDbGFzcyA9PT0gZ2VuQ2xhc3M7XG59O1xuIiwiJ3VzZSBzdHJpY3QnO1xuXG52YXIgaW1wbGVtZW50YXRpb24gPSByZXF1aXJlKCcuL2ltcGxlbWVudGF0aW9uJyk7XG5cbnZhciB6ZXJvV2lkdGhTcGFjZSA9ICdcXHUyMDBiJztcblxubW9kdWxlLmV4cG9ydHMgPSBmdW5jdGlvbiBnZXRQb2x5ZmlsbCgpIHtcblx0aWYgKFN0cmluZy5wcm90b3R5cGUudHJpbSAmJiB6ZXJvV2lkdGhTcGFjZS50cmltKCkgPT09IHplcm9XaWR0aFNwYWNlKSB7XG5cdFx0cmV0dXJuIFN0cmluZy5wcm90b3R5cGUudHJpbTtcblx0fVxuXHRyZXR1cm4gaW1wbGVtZW50YXRpb247XG59O1xuIiwiJ3VzZSBzdHJpY3QnO1xuXG52YXIgZGVmaW5lID0gcmVxdWlyZSgnZGVmaW5lLXByb3BlcnRpZXMnKTtcbnZhciBnZXRQb2x5ZmlsbCA9IHJlcXVpcmUoJy4vcG9seWZpbGwnKTtcblxubW9kdWxlLmV4cG9ydHMgPSBmdW5jdGlvbiBzaGltU3RyaW5nVHJpbSgpIHtcblx0dmFyIHBvbHlmaWxsID0gZ2V0UG9seWZpbGwoKTtcblx0ZGVmaW5lKFN0cmluZy5wcm90b3R5cGUsIHsgdHJpbTogcG9seWZpbGwgfSwgeyB0cmltOiBmdW5jdGlvbiAoKSB7IHJldHVybiBTdHJpbmcucHJvdG90eXBlLnRyaW0gIT09IHBvbHlmaWxsOyB9IH0pO1xuXHRyZXR1cm4gcG9seWZpbGw7XG59O1xuIiwidmFyIFN0cmVhbSA9IHJlcXVpcmUoJ3N0cmVhbScpXG5cbi8vIHRocm91Z2hcbi8vXG4vLyBhIHN0cmVhbSB0aGF0IGRvZXMgbm90aGluZyBidXQgcmUtZW1pdCB0aGUgaW5wdXQuXG4vLyB1c2VmdWwgZm9yIGFnZ3JlZ2F0aW5nIGEgc2VyaWVzIG9mIGNoYW5naW5nIGJ1dCBub3QgZW5kaW5nIHN0cmVhbXMgaW50byBvbmUgc3RyZWFtKVxuXG5leHBvcnRzID0gbW9kdWxlLmV4cG9ydHMgPSB0aHJvdWdoXG50aHJvdWdoLnRocm91Z2ggPSB0aHJvdWdoXG5cbi8vY3JlYXRlIGEgcmVhZGFibGUgd3JpdGFibGUgc3RyZWFtLlxuXG5mdW5jdGlvbiB0aHJvdWdoICh3cml0ZSwgZW5kLCBvcHRzKSB7XG4gIHdyaXRlID0gd3JpdGUgfHwgZnVuY3Rpb24gKGRhdGEpIHsgdGhpcy5xdWV1ZShkYXRhKSB9XG4gIGVuZCA9IGVuZCB8fCBmdW5jdGlvbiAoKSB7IHRoaXMucXVldWUobnVsbCkgfVxuXG4gIHZhciBlbmRlZCA9IGZhbHNlLCBkZXN0cm95ZWQgPSBmYWxzZSwgYnVmZmVyID0gW10sIF9lbmRlZCA9IGZhbHNlXG4gIHZhciBzdHJlYW0gPSBuZXcgU3RyZWFtKClcbiAgc3RyZWFtLnJlYWRhYmxlID0gc3RyZWFtLndyaXRhYmxlID0gdHJ1ZVxuICBzdHJlYW0ucGF1c2VkID0gZmFsc2VcblxuLy8gIHN0cmVhbS5hdXRvUGF1c2UgICA9ICEob3B0cyAmJiBvcHRzLmF1dG9QYXVzZSAgID09PSBmYWxzZSlcbiAgc3RyZWFtLmF1dG9EZXN0cm95ID0gIShvcHRzICYmIG9wdHMuYXV0b0Rlc3Ryb3kgPT09IGZhbHNlKVxuXG4gIHN0cmVhbS53cml0ZSA9IGZ1bmN0aW9uIChkYXRhKSB7XG4gICAgd3JpdGUuY2FsbCh0aGlzLCBkYXRhKVxuICAgIHJldHVybiAhc3RyZWFtLnBhdXNlZFxuICB9XG5cbiAgZnVuY3Rpb24gZHJhaW4oKSB7XG4gICAgd2hpbGUoYnVmZmVyLmxlbmd0aCAmJiAhc3RyZWFtLnBhdXNlZCkge1xuICAgICAgdmFyIGRhdGEgPSBidWZmZXIuc2hpZnQoKVxuICAgICAgaWYobnVsbCA9PT0gZGF0YSlcbiAgICAgICAgcmV0dXJuIHN0cmVhbS5lbWl0KCdlbmQnKVxuICAgICAgZWxzZVxuICAgICAgICBzdHJlYW0uZW1pdCgnZGF0YScsIGRhdGEpXG4gICAgfVxuICB9XG5cbiAgc3RyZWFtLnF1ZXVlID0gc3RyZWFtLnB1c2ggPSBmdW5jdGlvbiAoZGF0YSkge1xuLy8gICAgY29uc29sZS5lcnJvcihlbmRlZClcbiAgICBpZihfZW5kZWQpIHJldHVybiBzdHJlYW1cbiAgICBpZihkYXRhID09PSBudWxsKSBfZW5kZWQgPSB0cnVlXG4gICAgYnVmZmVyLnB1c2goZGF0YSlcbiAgICBkcmFpbigpXG4gICAgcmV0dXJuIHN0cmVhbVxuICB9XG5cbiAgLy90aGlzIHdpbGwgYmUgcmVnaXN0ZXJlZCBhcyB0aGUgZmlyc3QgJ2VuZCcgbGlzdGVuZXJcbiAgLy9tdXN0IGNhbGwgZGVzdHJveSBuZXh0IHRpY2ssIHRvIG1ha2Ugc3VyZSB3ZSdyZSBhZnRlciBhbnlcbiAgLy9zdHJlYW0gcGlwZWQgZnJvbSBoZXJlLlxuICAvL3RoaXMgaXMgb25seSBhIHByb2JsZW0gaWYgZW5kIGlzIG5vdCBlbWl0dGVkIHN5bmNocm9ub3VzbHkuXG4gIC8vYSBuaWNlciB3YXkgdG8gZG8gdGhpcyBpcyB0byBtYWtlIHN1cmUgdGhpcyBpcyB0aGUgbGFzdCBsaXN0ZW5lciBmb3IgJ2VuZCdcblxuICBzdHJlYW0ub24oJ2VuZCcsIGZ1bmN0aW9uICgpIHtcbiAgICBzdHJlYW0ucmVhZGFibGUgPSBmYWxzZVxuICAgIGlmKCFzdHJlYW0ud3JpdGFibGUgJiYgc3RyZWFtLmF1dG9EZXN0cm95KVxuICAgICAgcHJvY2Vzcy5uZXh0VGljayhmdW5jdGlvbiAoKSB7XG4gICAgICAgIHN0cmVhbS5kZXN0cm95KClcbiAgICAgIH0pXG4gIH0pXG5cbiAgZnVuY3Rpb24gX2VuZCAoKSB7XG4gICAgc3RyZWFtLndyaXRhYmxlID0gZmFsc2VcbiAgICBlbmQuY2FsbChzdHJlYW0pXG4gICAgaWYoIXN0cmVhbS5yZWFkYWJsZSAmJiBzdHJlYW0uYXV0b0Rlc3Ryb3kpXG4gICAgICBzdHJlYW0uZGVzdHJveSgpXG4gIH1cblxuICBzdHJlYW0uZW5kID0gZnVuY3Rpb24gKGRhdGEpIHtcbiAgICBpZihlbmRlZCkgcmV0dXJuXG4gICAgZW5kZWQgPSB0cnVlXG4gICAgaWYoYXJndW1lbnRzLmxlbmd0aCkgc3RyZWFtLndyaXRlKGRhdGEpXG4gICAgX2VuZCgpIC8vIHdpbGwgZW1pdCBvciBxdWV1ZVxuICAgIHJldHVybiBzdHJlYW1cbiAgfVxuXG4gIHN0cmVhbS5kZXN0cm95ID0gZnVuY3Rpb24gKCkge1xuICAgIGlmKGRlc3Ryb3llZCkgcmV0dXJuXG4gICAgZGVzdHJveWVkID0gdHJ1ZVxuICAgIGVuZGVkID0gdHJ1ZVxuICAgIGJ1ZmZlci5sZW5ndGggPSAwXG4gICAgc3RyZWFtLndyaXRhYmxlID0gc3RyZWFtLnJlYWRhYmxlID0gZmFsc2VcbiAgICBzdHJlYW0uZW1pdCgnY2xvc2UnKVxuICAgIHJldHVybiBzdHJlYW1cbiAgfVxuXG4gIHN0cmVhbS5wYXVzZSA9IGZ1bmN0aW9uICgpIHtcbiAgICBpZihzdHJlYW0ucGF1c2VkKSByZXR1cm5cbiAgICBzdHJlYW0ucGF1c2VkID0gdHJ1ZVxuICAgIHJldHVybiBzdHJlYW1cbiAgfVxuXG4gIHN0cmVhbS5yZXN1bWUgPSBmdW5jdGlvbiAoKSB7XG4gICAgaWYoc3RyZWFtLnBhdXNlZCkge1xuICAgICAgc3RyZWFtLnBhdXNlZCA9IGZhbHNlXG4gICAgICBzdHJlYW0uZW1pdCgncmVzdW1lJylcbiAgICB9XG4gICAgZHJhaW4oKVxuICAgIC8vbWF5IGhhdmUgYmVjb21lIHBhdXNlZCBhZ2FpbixcbiAgICAvL2FzIGRyYWluIGVtaXRzICdkYXRhJy5cbiAgICBpZighc3RyZWFtLnBhdXNlZClcbiAgICAgIHN0cmVhbS5lbWl0KCdkcmFpbicpXG4gICAgcmV0dXJuIHN0cmVhbVxuICB9XG4gIHJldHVybiBzdHJlYW1cbn1cblxuIiwiIiwiLyohXG4gKiBUaGUgYnVmZmVyIG1vZHVsZSBmcm9tIG5vZGUuanMsIGZvciB0aGUgYnJvd3Nlci5cbiAqXG4gKiBAYXV0aG9yICAgRmVyb3NzIEFib3VraGFkaWplaCA8ZmVyb3NzQGZlcm9zcy5vcmc+IDxodHRwOi8vZmVyb3NzLm9yZz5cbiAqIEBsaWNlbnNlICBNSVRcbiAqL1xuLyogZXNsaW50LWRpc2FibGUgbm8tcHJvdG8gKi9cblxuJ3VzZSBzdHJpY3QnXG5cbnZhciBiYXNlNjQgPSByZXF1aXJlKCdiYXNlNjQtanMnKVxudmFyIGllZWU3NTQgPSByZXF1aXJlKCdpZWVlNzU0JylcbnZhciBpc0FycmF5ID0gcmVxdWlyZSgnaXNhcnJheScpXG5cbmV4cG9ydHMuQnVmZmVyID0gQnVmZmVyXG5leHBvcnRzLlNsb3dCdWZmZXIgPSBTbG93QnVmZmVyXG5leHBvcnRzLklOU1BFQ1RfTUFYX0JZVEVTID0gNTBcbkJ1ZmZlci5wb29sU2l6ZSA9IDgxOTIgLy8gbm90IHVzZWQgYnkgdGhpcyBpbXBsZW1lbnRhdGlvblxuXG52YXIgcm9vdFBhcmVudCA9IHt9XG5cbi8qKlxuICogSWYgYEJ1ZmZlci5UWVBFRF9BUlJBWV9TVVBQT1JUYDpcbiAqICAgPT09IHRydWUgICAgVXNlIFVpbnQ4QXJyYXkgaW1wbGVtZW50YXRpb24gKGZhc3Rlc3QpXG4gKiAgID09PSBmYWxzZSAgIFVzZSBPYmplY3QgaW1wbGVtZW50YXRpb24gKG1vc3QgY29tcGF0aWJsZSwgZXZlbiBJRTYpXG4gKlxuICogQnJvd3NlcnMgdGhhdCBzdXBwb3J0IHR5cGVkIGFycmF5cyBhcmUgSUUgMTArLCBGaXJlZm94IDQrLCBDaHJvbWUgNyssIFNhZmFyaSA1LjErLFxuICogT3BlcmEgMTEuNissIGlPUyA0LjIrLlxuICpcbiAqIER1ZSB0byB2YXJpb3VzIGJyb3dzZXIgYnVncywgc29tZXRpbWVzIHRoZSBPYmplY3QgaW1wbGVtZW50YXRpb24gd2lsbCBiZSB1c2VkIGV2ZW5cbiAqIHdoZW4gdGhlIGJyb3dzZXIgc3VwcG9ydHMgdHlwZWQgYXJyYXlzLlxuICpcbiAqIE5vdGU6XG4gKlxuICogICAtIEZpcmVmb3ggNC0yOSBsYWNrcyBzdXBwb3J0IGZvciBhZGRpbmcgbmV3IHByb3BlcnRpZXMgdG8gYFVpbnQ4QXJyYXlgIGluc3RhbmNlcyxcbiAqICAgICBTZWU6IGh0dHBzOi8vYnVnemlsbGEubW96aWxsYS5vcmcvc2hvd19idWcuY2dpP2lkPTY5NTQzOC5cbiAqXG4gKiAgIC0gQ2hyb21lIDktMTAgaXMgbWlzc2luZyB0aGUgYFR5cGVkQXJyYXkucHJvdG90eXBlLnN1YmFycmF5YCBmdW5jdGlvbi5cbiAqXG4gKiAgIC0gSUUxMCBoYXMgYSBicm9rZW4gYFR5cGVkQXJyYXkucHJvdG90eXBlLnN1YmFycmF5YCBmdW5jdGlvbiB3aGljaCByZXR1cm5zIGFycmF5cyBvZlxuICogICAgIGluY29ycmVjdCBsZW5ndGggaW4gc29tZSBzaXR1YXRpb25zLlxuXG4gKiBXZSBkZXRlY3QgdGhlc2UgYnVnZ3kgYnJvd3NlcnMgYW5kIHNldCBgQnVmZmVyLlRZUEVEX0FSUkFZX1NVUFBPUlRgIHRvIGBmYWxzZWAgc28gdGhleVxuICogZ2V0IHRoZSBPYmplY3QgaW1wbGVtZW50YXRpb24sIHdoaWNoIGlzIHNsb3dlciBidXQgYmVoYXZlcyBjb3JyZWN0bHkuXG4gKi9cbkJ1ZmZlci5UWVBFRF9BUlJBWV9TVVBQT1JUID0gZ2xvYmFsLlRZUEVEX0FSUkFZX1NVUFBPUlQgIT09IHVuZGVmaW5lZFxuICA/IGdsb2JhbC5UWVBFRF9BUlJBWV9TVVBQT1JUXG4gIDogdHlwZWRBcnJheVN1cHBvcnQoKVxuXG5mdW5jdGlvbiB0eXBlZEFycmF5U3VwcG9ydCAoKSB7XG4gIHRyeSB7XG4gICAgdmFyIGFyciA9IG5ldyBVaW50OEFycmF5KDEpXG4gICAgYXJyLmZvbyA9IGZ1bmN0aW9uICgpIHsgcmV0dXJuIDQyIH1cbiAgICByZXR1cm4gYXJyLmZvbygpID09PSA0MiAmJiAvLyB0eXBlZCBhcnJheSBpbnN0YW5jZXMgY2FuIGJlIGF1Z21lbnRlZFxuICAgICAgICB0eXBlb2YgYXJyLnN1YmFycmF5ID09PSAnZnVuY3Rpb24nICYmIC8vIGNocm9tZSA5LTEwIGxhY2sgYHN1YmFycmF5YFxuICAgICAgICBhcnIuc3ViYXJyYXkoMSwgMSkuYnl0ZUxlbmd0aCA9PT0gMCAvLyBpZTEwIGhhcyBicm9rZW4gYHN1YmFycmF5YFxuICB9IGNhdGNoIChlKSB7XG4gICAgcmV0dXJuIGZhbHNlXG4gIH1cbn1cblxuZnVuY3Rpb24ga01heExlbmd0aCAoKSB7XG4gIHJldHVybiBCdWZmZXIuVFlQRURfQVJSQVlfU1VQUE9SVFxuICAgID8gMHg3ZmZmZmZmZlxuICAgIDogMHgzZmZmZmZmZlxufVxuXG4vKipcbiAqIFRoZSBCdWZmZXIgY29uc3RydWN0b3IgcmV0dXJucyBpbnN0YW5jZXMgb2YgYFVpbnQ4QXJyYXlgIHRoYXQgaGF2ZSB0aGVpclxuICogcHJvdG90eXBlIGNoYW5nZWQgdG8gYEJ1ZmZlci5wcm90b3R5cGVgLiBGdXJ0aGVybW9yZSwgYEJ1ZmZlcmAgaXMgYSBzdWJjbGFzcyBvZlxuICogYFVpbnQ4QXJyYXlgLCBzbyB0aGUgcmV0dXJuZWQgaW5zdGFuY2VzIHdpbGwgaGF2ZSBhbGwgdGhlIG5vZGUgYEJ1ZmZlcmAgbWV0aG9kc1xuICogYW5kIHRoZSBgVWludDhBcnJheWAgbWV0aG9kcy4gU3F1YXJlIGJyYWNrZXQgbm90YXRpb24gd29ya3MgYXMgZXhwZWN0ZWQgLS0gaXRcbiAqIHJldHVybnMgYSBzaW5nbGUgb2N0ZXQuXG4gKlxuICogVGhlIGBVaW50OEFycmF5YCBwcm90b3R5cGUgcmVtYWlucyB1bm1vZGlmaWVkLlxuICovXG5mdW5jdGlvbiBCdWZmZXIgKGFyZykge1xuICBpZiAoISh0aGlzIGluc3RhbmNlb2YgQnVmZmVyKSkge1xuICAgIC8vIEF2b2lkIGdvaW5nIHRocm91Z2ggYW4gQXJndW1lbnRzQWRhcHRvclRyYW1wb2xpbmUgaW4gdGhlIGNvbW1vbiBjYXNlLlxuICAgIGlmIChhcmd1bWVudHMubGVuZ3RoID4gMSkgcmV0dXJuIG5ldyBCdWZmZXIoYXJnLCBhcmd1bWVudHNbMV0pXG4gICAgcmV0dXJuIG5ldyBCdWZmZXIoYXJnKVxuICB9XG5cbiAgaWYgKCFCdWZmZXIuVFlQRURfQVJSQVlfU1VQUE9SVCkge1xuICAgIHRoaXMubGVuZ3RoID0gMFxuICAgIHRoaXMucGFyZW50ID0gdW5kZWZpbmVkXG4gIH1cblxuICAvLyBDb21tb24gY2FzZS5cbiAgaWYgKHR5cGVvZiBhcmcgPT09ICdudW1iZXInKSB7XG4gICAgcmV0dXJuIGZyb21OdW1iZXIodGhpcywgYXJnKVxuICB9XG5cbiAgLy8gU2xpZ2h0bHkgbGVzcyBjb21tb24gY2FzZS5cbiAgaWYgKHR5cGVvZiBhcmcgPT09ICdzdHJpbmcnKSB7XG4gICAgcmV0dXJuIGZyb21TdHJpbmcodGhpcywgYXJnLCBhcmd1bWVudHMubGVuZ3RoID4gMSA/IGFyZ3VtZW50c1sxXSA6ICd1dGY4JylcbiAgfVxuXG4gIC8vIFVudXN1YWwuXG4gIHJldHVybiBmcm9tT2JqZWN0KHRoaXMsIGFyZylcbn1cblxuLy8gVE9ETzogTGVnYWN5LCBub3QgbmVlZGVkIGFueW1vcmUuIFJlbW92ZSBpbiBuZXh0IG1ham9yIHZlcnNpb24uXG5CdWZmZXIuX2F1Z21lbnQgPSBmdW5jdGlvbiAoYXJyKSB7XG4gIGFyci5fX3Byb3RvX18gPSBCdWZmZXIucHJvdG90eXBlXG4gIHJldHVybiBhcnJcbn1cblxuZnVuY3Rpb24gZnJvbU51bWJlciAodGhhdCwgbGVuZ3RoKSB7XG4gIHRoYXQgPSBhbGxvY2F0ZSh0aGF0LCBsZW5ndGggPCAwID8gMCA6IGNoZWNrZWQobGVuZ3RoKSB8IDApXG4gIGlmICghQnVmZmVyLlRZUEVEX0FSUkFZX1NVUFBPUlQpIHtcbiAgICBmb3IgKHZhciBpID0gMDsgaSA8IGxlbmd0aDsgaSsrKSB7XG4gICAgICB0aGF0W2ldID0gMFxuICAgIH1cbiAgfVxuICByZXR1cm4gdGhhdFxufVxuXG5mdW5jdGlvbiBmcm9tU3RyaW5nICh0aGF0LCBzdHJpbmcsIGVuY29kaW5nKSB7XG4gIGlmICh0eXBlb2YgZW5jb2RpbmcgIT09ICdzdHJpbmcnIHx8IGVuY29kaW5nID09PSAnJykgZW5jb2RpbmcgPSAndXRmOCdcblxuICAvLyBBc3N1bXB0aW9uOiBieXRlTGVuZ3RoKCkgcmV0dXJuIHZhbHVlIGlzIGFsd2F5cyA8IGtNYXhMZW5ndGguXG4gIHZhciBsZW5ndGggPSBieXRlTGVuZ3RoKHN0cmluZywgZW5jb2RpbmcpIHwgMFxuICB0aGF0ID0gYWxsb2NhdGUodGhhdCwgbGVuZ3RoKVxuXG4gIHRoYXQud3JpdGUoc3RyaW5nLCBlbmNvZGluZylcbiAgcmV0dXJuIHRoYXRcbn1cblxuZnVuY3Rpb24gZnJvbU9iamVjdCAodGhhdCwgb2JqZWN0KSB7XG4gIGlmIChCdWZmZXIuaXNCdWZmZXIob2JqZWN0KSkgcmV0dXJuIGZyb21CdWZmZXIodGhhdCwgb2JqZWN0KVxuXG4gIGlmIChpc0FycmF5KG9iamVjdCkpIHJldHVybiBmcm9tQXJyYXkodGhhdCwgb2JqZWN0KVxuXG4gIGlmIChvYmplY3QgPT0gbnVsbCkge1xuICAgIHRocm93IG5ldyBUeXBlRXJyb3IoJ211c3Qgc3RhcnQgd2l0aCBudW1iZXIsIGJ1ZmZlciwgYXJyYXkgb3Igc3RyaW5nJylcbiAgfVxuXG4gIGlmICh0eXBlb2YgQXJyYXlCdWZmZXIgIT09ICd1bmRlZmluZWQnKSB7XG4gICAgaWYgKG9iamVjdC5idWZmZXIgaW5zdGFuY2VvZiBBcnJheUJ1ZmZlcikge1xuICAgICAgcmV0dXJuIGZyb21UeXBlZEFycmF5KHRoYXQsIG9iamVjdClcbiAgICB9XG4gICAgaWYgKG9iamVjdCBpbnN0YW5jZW9mIEFycmF5QnVmZmVyKSB7XG4gICAgICByZXR1cm4gZnJvbUFycmF5QnVmZmVyKHRoYXQsIG9iamVjdClcbiAgICB9XG4gIH1cblxuICBpZiAob2JqZWN0Lmxlbmd0aCkgcmV0dXJuIGZyb21BcnJheUxpa2UodGhhdCwgb2JqZWN0KVxuXG4gIHJldHVybiBmcm9tSnNvbk9iamVjdCh0aGF0LCBvYmplY3QpXG59XG5cbmZ1bmN0aW9uIGZyb21CdWZmZXIgKHRoYXQsIGJ1ZmZlcikge1xuICB2YXIgbGVuZ3RoID0gY2hlY2tlZChidWZmZXIubGVuZ3RoKSB8IDBcbiAgdGhhdCA9IGFsbG9jYXRlKHRoYXQsIGxlbmd0aClcbiAgYnVmZmVyLmNvcHkodGhhdCwgMCwgMCwgbGVuZ3RoKVxuICByZXR1cm4gdGhhdFxufVxuXG5mdW5jdGlvbiBmcm9tQXJyYXkgKHRoYXQsIGFycmF5KSB7XG4gIHZhciBsZW5ndGggPSBjaGVja2VkKGFycmF5Lmxlbmd0aCkgfCAwXG4gIHRoYXQgPSBhbGxvY2F0ZSh0aGF0LCBsZW5ndGgpXG4gIGZvciAodmFyIGkgPSAwOyBpIDwgbGVuZ3RoOyBpICs9IDEpIHtcbiAgICB0aGF0W2ldID0gYXJyYXlbaV0gJiAyNTVcbiAgfVxuICByZXR1cm4gdGhhdFxufVxuXG4vLyBEdXBsaWNhdGUgb2YgZnJvbUFycmF5KCkgdG8ga2VlcCBmcm9tQXJyYXkoKSBtb25vbW9ycGhpYy5cbmZ1bmN0aW9uIGZyb21UeXBlZEFycmF5ICh0aGF0LCBhcnJheSkge1xuICB2YXIgbGVuZ3RoID0gY2hlY2tlZChhcnJheS5sZW5ndGgpIHwgMFxuICB0aGF0ID0gYWxsb2NhdGUodGhhdCwgbGVuZ3RoKVxuICAvLyBUcnVuY2F0aW5nIHRoZSBlbGVtZW50cyBpcyBwcm9iYWJseSBub3Qgd2hhdCBwZW9wbGUgZXhwZWN0IGZyb20gdHlwZWRcbiAgLy8gYXJyYXlzIHdpdGggQllURVNfUEVSX0VMRU1FTlQgPiAxIGJ1dCBpdCdzIGNvbXBhdGlibGUgd2l0aCB0aGUgYmVoYXZpb3JcbiAgLy8gb2YgdGhlIG9sZCBCdWZmZXIgY29uc3RydWN0b3IuXG4gIGZvciAodmFyIGkgPSAwOyBpIDwgbGVuZ3RoOyBpICs9IDEpIHtcbiAgICB0aGF0W2ldID0gYXJyYXlbaV0gJiAyNTVcbiAgfVxuICByZXR1cm4gdGhhdFxufVxuXG5mdW5jdGlvbiBmcm9tQXJyYXlCdWZmZXIgKHRoYXQsIGFycmF5KSB7XG4gIGFycmF5LmJ5dGVMZW5ndGggLy8gdGhpcyB0aHJvd3MgaWYgYGFycmF5YCBpcyBub3QgYSB2YWxpZCBBcnJheUJ1ZmZlclxuXG4gIGlmIChCdWZmZXIuVFlQRURfQVJSQVlfU1VQUE9SVCkge1xuICAgIC8vIFJldHVybiBhbiBhdWdtZW50ZWQgYFVpbnQ4QXJyYXlgIGluc3RhbmNlLCBmb3IgYmVzdCBwZXJmb3JtYW5jZVxuICAgIHRoYXQgPSBuZXcgVWludDhBcnJheShhcnJheSlcbiAgICB0aGF0Ll9fcHJvdG9fXyA9IEJ1ZmZlci5wcm90b3R5cGVcbiAgfSBlbHNlIHtcbiAgICAvLyBGYWxsYmFjazogUmV0dXJuIGFuIG9iamVjdCBpbnN0YW5jZSBvZiB0aGUgQnVmZmVyIGNsYXNzXG4gICAgdGhhdCA9IGZyb21UeXBlZEFycmF5KHRoYXQsIG5ldyBVaW50OEFycmF5KGFycmF5KSlcbiAgfVxuICByZXR1cm4gdGhhdFxufVxuXG5mdW5jdGlvbiBmcm9tQXJyYXlMaWtlICh0aGF0LCBhcnJheSkge1xuICB2YXIgbGVuZ3RoID0gY2hlY2tlZChhcnJheS5sZW5ndGgpIHwgMFxuICB0aGF0ID0gYWxsb2NhdGUodGhhdCwgbGVuZ3RoKVxuICBmb3IgKHZhciBpID0gMDsgaSA8IGxlbmd0aDsgaSArPSAxKSB7XG4gICAgdGhhdFtpXSA9IGFycmF5W2ldICYgMjU1XG4gIH1cbiAgcmV0dXJuIHRoYXRcbn1cblxuLy8gRGVzZXJpYWxpemUgeyB0eXBlOiAnQnVmZmVyJywgZGF0YTogWzEsMiwzLC4uLl0gfSBpbnRvIGEgQnVmZmVyIG9iamVjdC5cbi8vIFJldHVybnMgYSB6ZXJvLWxlbmd0aCBidWZmZXIgZm9yIGlucHV0cyB0aGF0IGRvbid0IGNvbmZvcm0gdG8gdGhlIHNwZWMuXG5mdW5jdGlvbiBmcm9tSnNvbk9iamVjdCAodGhhdCwgb2JqZWN0KSB7XG4gIHZhciBhcnJheVxuICB2YXIgbGVuZ3RoID0gMFxuXG4gIGlmIChvYmplY3QudHlwZSA9PT0gJ0J1ZmZlcicgJiYgaXNBcnJheShvYmplY3QuZGF0YSkpIHtcbiAgICBhcnJheSA9IG9iamVjdC5kYXRhXG4gICAgbGVuZ3RoID0gY2hlY2tlZChhcnJheS5sZW5ndGgpIHwgMFxuICB9XG4gIHRoYXQgPSBhbGxvY2F0ZSh0aGF0LCBsZW5ndGgpXG5cbiAgZm9yICh2YXIgaSA9IDA7IGkgPCBsZW5ndGg7IGkgKz0gMSkge1xuICAgIHRoYXRbaV0gPSBhcnJheVtpXSAmIDI1NVxuICB9XG4gIHJldHVybiB0aGF0XG59XG5cbmlmIChCdWZmZXIuVFlQRURfQVJSQVlfU1VQUE9SVCkge1xuICBCdWZmZXIucHJvdG90eXBlLl9fcHJvdG9fXyA9IFVpbnQ4QXJyYXkucHJvdG90eXBlXG4gIEJ1ZmZlci5fX3Byb3RvX18gPSBVaW50OEFycmF5XG59IGVsc2Uge1xuICAvLyBwcmUtc2V0IGZvciB2YWx1ZXMgdGhhdCBtYXkgZXhpc3QgaW4gdGhlIGZ1dHVyZVxuICBCdWZmZXIucHJvdG90eXBlLmxlbmd0aCA9IHVuZGVmaW5lZFxuICBCdWZmZXIucHJvdG90eXBlLnBhcmVudCA9IHVuZGVmaW5lZFxufVxuXG5mdW5jdGlvbiBhbGxvY2F0ZSAodGhhdCwgbGVuZ3RoKSB7XG4gIGlmIChCdWZmZXIuVFlQRURfQVJSQVlfU1VQUE9SVCkge1xuICAgIC8vIFJldHVybiBhbiBhdWdtZW50ZWQgYFVpbnQ4QXJyYXlgIGluc3RhbmNlLCBmb3IgYmVzdCBwZXJmb3JtYW5jZVxuICAgIHRoYXQgPSBuZXcgVWludDhBcnJheShsZW5ndGgpXG4gICAgdGhhdC5fX3Byb3RvX18gPSBCdWZmZXIucHJvdG90eXBlXG4gIH0gZWxzZSB7XG4gICAgLy8gRmFsbGJhY2s6IFJldHVybiBhbiBvYmplY3QgaW5zdGFuY2Ugb2YgdGhlIEJ1ZmZlciBjbGFzc1xuICAgIHRoYXQubGVuZ3RoID0gbGVuZ3RoXG4gIH1cblxuICB2YXIgZnJvbVBvb2wgPSBsZW5ndGggIT09IDAgJiYgbGVuZ3RoIDw9IEJ1ZmZlci5wb29sU2l6ZSA+Pj4gMVxuICBpZiAoZnJvbVBvb2wpIHRoYXQucGFyZW50ID0gcm9vdFBhcmVudFxuXG4gIHJldHVybiB0aGF0XG59XG5cbmZ1bmN0aW9uIGNoZWNrZWQgKGxlbmd0aCkge1xuICAvLyBOb3RlOiBjYW5ub3QgdXNlIGBsZW5ndGggPCBrTWF4TGVuZ3RoYCBoZXJlIGJlY2F1c2UgdGhhdCBmYWlscyB3aGVuXG4gIC8vIGxlbmd0aCBpcyBOYU4gKHdoaWNoIGlzIG90aGVyd2lzZSBjb2VyY2VkIHRvIHplcm8uKVxuICBpZiAobGVuZ3RoID49IGtNYXhMZW5ndGgoKSkge1xuICAgIHRocm93IG5ldyBSYW5nZUVycm9yKCdBdHRlbXB0IHRvIGFsbG9jYXRlIEJ1ZmZlciBsYXJnZXIgdGhhbiBtYXhpbXVtICcgK1xuICAgICAgICAgICAgICAgICAgICAgICAgICdzaXplOiAweCcgKyBrTWF4TGVuZ3RoKCkudG9TdHJpbmcoMTYpICsgJyBieXRlcycpXG4gIH1cbiAgcmV0dXJuIGxlbmd0aCB8IDBcbn1cblxuZnVuY3Rpb24gU2xvd0J1ZmZlciAoc3ViamVjdCwgZW5jb2RpbmcpIHtcbiAgaWYgKCEodGhpcyBpbnN0YW5jZW9mIFNsb3dCdWZmZXIpKSByZXR1cm4gbmV3IFNsb3dCdWZmZXIoc3ViamVjdCwgZW5jb2RpbmcpXG5cbiAgdmFyIGJ1ZiA9IG5ldyBCdWZmZXIoc3ViamVjdCwgZW5jb2RpbmcpXG4gIGRlbGV0ZSBidWYucGFyZW50XG4gIHJldHVybiBidWZcbn1cblxuQnVmZmVyLmlzQnVmZmVyID0gZnVuY3Rpb24gaXNCdWZmZXIgKGIpIHtcbiAgcmV0dXJuICEhKGIgIT0gbnVsbCAmJiBiLl9pc0J1ZmZlcilcbn1cblxuQnVmZmVyLmNvbXBhcmUgPSBmdW5jdGlvbiBjb21wYXJlIChhLCBiKSB7XG4gIGlmICghQnVmZmVyLmlzQnVmZmVyKGEpIHx8ICFCdWZmZXIuaXNCdWZmZXIoYikpIHtcbiAgICB0aHJvdyBuZXcgVHlwZUVycm9yKCdBcmd1bWVudHMgbXVzdCBiZSBCdWZmZXJzJylcbiAgfVxuXG4gIGlmIChhID09PSBiKSByZXR1cm4gMFxuXG4gIHZhciB4ID0gYS5sZW5ndGhcbiAgdmFyIHkgPSBiLmxlbmd0aFxuXG4gIHZhciBpID0gMFxuICB2YXIgbGVuID0gTWF0aC5taW4oeCwgeSlcbiAgd2hpbGUgKGkgPCBsZW4pIHtcbiAgICBpZiAoYVtpXSAhPT0gYltpXSkgYnJlYWtcblxuICAgICsraVxuICB9XG5cbiAgaWYgKGkgIT09IGxlbikge1xuICAgIHggPSBhW2ldXG4gICAgeSA9IGJbaV1cbiAgfVxuXG4gIGlmICh4IDwgeSkgcmV0dXJuIC0xXG4gIGlmICh5IDwgeCkgcmV0dXJuIDFcbiAgcmV0dXJuIDBcbn1cblxuQnVmZmVyLmlzRW5jb2RpbmcgPSBmdW5jdGlvbiBpc0VuY29kaW5nIChlbmNvZGluZykge1xuICBzd2l0Y2ggKFN0cmluZyhlbmNvZGluZykudG9Mb3dlckNhc2UoKSkge1xuICAgIGNhc2UgJ2hleCc6XG4gICAgY2FzZSAndXRmOCc6XG4gICAgY2FzZSAndXRmLTgnOlxuICAgIGNhc2UgJ2FzY2lpJzpcbiAgICBjYXNlICdiaW5hcnknOlxuICAgIGNhc2UgJ2Jhc2U2NCc6XG4gICAgY2FzZSAncmF3JzpcbiAgICBjYXNlICd1Y3MyJzpcbiAgICBjYXNlICd1Y3MtMic6XG4gICAgY2FzZSAndXRmMTZsZSc6XG4gICAgY2FzZSAndXRmLTE2bGUnOlxuICAgICAgcmV0dXJuIHRydWVcbiAgICBkZWZhdWx0OlxuICAgICAgcmV0dXJuIGZhbHNlXG4gIH1cbn1cblxuQnVmZmVyLmNvbmNhdCA9IGZ1bmN0aW9uIGNvbmNhdCAobGlzdCwgbGVuZ3RoKSB7XG4gIGlmICghaXNBcnJheShsaXN0KSkgdGhyb3cgbmV3IFR5cGVFcnJvcignbGlzdCBhcmd1bWVudCBtdXN0IGJlIGFuIEFycmF5IG9mIEJ1ZmZlcnMuJylcblxuICBpZiAobGlzdC5sZW5ndGggPT09IDApIHtcbiAgICByZXR1cm4gbmV3IEJ1ZmZlcigwKVxuICB9XG5cbiAgdmFyIGlcbiAgaWYgKGxlbmd0aCA9PT0gdW5kZWZpbmVkKSB7XG4gICAgbGVuZ3RoID0gMFxuICAgIGZvciAoaSA9IDA7IGkgPCBsaXN0Lmxlbmd0aDsgaSsrKSB7XG4gICAgICBsZW5ndGggKz0gbGlzdFtpXS5sZW5ndGhcbiAgICB9XG4gIH1cblxuICB2YXIgYnVmID0gbmV3IEJ1ZmZlcihsZW5ndGgpXG4gIHZhciBwb3MgPSAwXG4gIGZvciAoaSA9IDA7IGkgPCBsaXN0Lmxlbmd0aDsgaSsrKSB7XG4gICAgdmFyIGl0ZW0gPSBsaXN0W2ldXG4gICAgaXRlbS5jb3B5KGJ1ZiwgcG9zKVxuICAgIHBvcyArPSBpdGVtLmxlbmd0aFxuICB9XG4gIHJldHVybiBidWZcbn1cblxuZnVuY3Rpb24gYnl0ZUxlbmd0aCAoc3RyaW5nLCBlbmNvZGluZykge1xuICBpZiAodHlwZW9mIHN0cmluZyAhPT0gJ3N0cmluZycpIHN0cmluZyA9ICcnICsgc3RyaW5nXG5cbiAgdmFyIGxlbiA9IHN0cmluZy5sZW5ndGhcbiAgaWYgKGxlbiA9PT0gMCkgcmV0dXJuIDBcblxuICAvLyBVc2UgYSBmb3IgbG9vcCB0byBhdm9pZCByZWN1cnNpb25cbiAgdmFyIGxvd2VyZWRDYXNlID0gZmFsc2VcbiAgZm9yICg7Oykge1xuICAgIHN3aXRjaCAoZW5jb2RpbmcpIHtcbiAgICAgIGNhc2UgJ2FzY2lpJzpcbiAgICAgIGNhc2UgJ2JpbmFyeSc6XG4gICAgICAvLyBEZXByZWNhdGVkXG4gICAgICBjYXNlICdyYXcnOlxuICAgICAgY2FzZSAncmF3cyc6XG4gICAgICAgIHJldHVybiBsZW5cbiAgICAgIGNhc2UgJ3V0ZjgnOlxuICAgICAgY2FzZSAndXRmLTgnOlxuICAgICAgICByZXR1cm4gdXRmOFRvQnl0ZXMoc3RyaW5nKS5sZW5ndGhcbiAgICAgIGNhc2UgJ3VjczInOlxuICAgICAgY2FzZSAndWNzLTInOlxuICAgICAgY2FzZSAndXRmMTZsZSc6XG4gICAgICBjYXNlICd1dGYtMTZsZSc6XG4gICAgICAgIHJldHVybiBsZW4gKiAyXG4gICAgICBjYXNlICdoZXgnOlxuICAgICAgICByZXR1cm4gbGVuID4+PiAxXG4gICAgICBjYXNlICdiYXNlNjQnOlxuICAgICAgICByZXR1cm4gYmFzZTY0VG9CeXRlcyhzdHJpbmcpLmxlbmd0aFxuICAgICAgZGVmYXVsdDpcbiAgICAgICAgaWYgKGxvd2VyZWRDYXNlKSByZXR1cm4gdXRmOFRvQnl0ZXMoc3RyaW5nKS5sZW5ndGggLy8gYXNzdW1lIHV0ZjhcbiAgICAgICAgZW5jb2RpbmcgPSAoJycgKyBlbmNvZGluZykudG9Mb3dlckNhc2UoKVxuICAgICAgICBsb3dlcmVkQ2FzZSA9IHRydWVcbiAgICB9XG4gIH1cbn1cbkJ1ZmZlci5ieXRlTGVuZ3RoID0gYnl0ZUxlbmd0aFxuXG5mdW5jdGlvbiBzbG93VG9TdHJpbmcgKGVuY29kaW5nLCBzdGFydCwgZW5kKSB7XG4gIHZhciBsb3dlcmVkQ2FzZSA9IGZhbHNlXG5cbiAgc3RhcnQgPSBzdGFydCB8IDBcbiAgZW5kID0gZW5kID09PSB1bmRlZmluZWQgfHwgZW5kID09PSBJbmZpbml0eSA/IHRoaXMubGVuZ3RoIDogZW5kIHwgMFxuXG4gIGlmICghZW5jb2RpbmcpIGVuY29kaW5nID0gJ3V0ZjgnXG4gIGlmIChzdGFydCA8IDApIHN0YXJ0ID0gMFxuICBpZiAoZW5kID4gdGhpcy5sZW5ndGgpIGVuZCA9IHRoaXMubGVuZ3RoXG4gIGlmIChlbmQgPD0gc3RhcnQpIHJldHVybiAnJ1xuXG4gIHdoaWxlICh0cnVlKSB7XG4gICAgc3dpdGNoIChlbmNvZGluZykge1xuICAgICAgY2FzZSAnaGV4JzpcbiAgICAgICAgcmV0dXJuIGhleFNsaWNlKHRoaXMsIHN0YXJ0LCBlbmQpXG5cbiAgICAgIGNhc2UgJ3V0ZjgnOlxuICAgICAgY2FzZSAndXRmLTgnOlxuICAgICAgICByZXR1cm4gdXRmOFNsaWNlKHRoaXMsIHN0YXJ0LCBlbmQpXG5cbiAgICAgIGNhc2UgJ2FzY2lpJzpcbiAgICAgICAgcmV0dXJuIGFzY2lpU2xpY2UodGhpcywgc3RhcnQsIGVuZClcblxuICAgICAgY2FzZSAnYmluYXJ5JzpcbiAgICAgICAgcmV0dXJuIGJpbmFyeVNsaWNlKHRoaXMsIHN0YXJ0LCBlbmQpXG5cbiAgICAgIGNhc2UgJ2Jhc2U2NCc6XG4gICAgICAgIHJldHVybiBiYXNlNjRTbGljZSh0aGlzLCBzdGFydCwgZW5kKVxuXG4gICAgICBjYXNlICd1Y3MyJzpcbiAgICAgIGNhc2UgJ3Vjcy0yJzpcbiAgICAgIGNhc2UgJ3V0ZjE2bGUnOlxuICAgICAgY2FzZSAndXRmLTE2bGUnOlxuICAgICAgICByZXR1cm4gdXRmMTZsZVNsaWNlKHRoaXMsIHN0YXJ0LCBlbmQpXG5cbiAgICAgIGRlZmF1bHQ6XG4gICAgICAgIGlmIChsb3dlcmVkQ2FzZSkgdGhyb3cgbmV3IFR5cGVFcnJvcignVW5rbm93biBlbmNvZGluZzogJyArIGVuY29kaW5nKVxuICAgICAgICBlbmNvZGluZyA9IChlbmNvZGluZyArICcnKS50b0xvd2VyQ2FzZSgpXG4gICAgICAgIGxvd2VyZWRDYXNlID0gdHJ1ZVxuICAgIH1cbiAgfVxufVxuXG4vLyBUaGUgcHJvcGVydHkgaXMgdXNlZCBieSBgQnVmZmVyLmlzQnVmZmVyYCBhbmQgYGlzLWJ1ZmZlcmAgKGluIFNhZmFyaSA1LTcpIHRvIGRldGVjdFxuLy8gQnVmZmVyIGluc3RhbmNlcy5cbkJ1ZmZlci5wcm90b3R5cGUuX2lzQnVmZmVyID0gdHJ1ZVxuXG5CdWZmZXIucHJvdG90eXBlLnRvU3RyaW5nID0gZnVuY3Rpb24gdG9TdHJpbmcgKCkge1xuICB2YXIgbGVuZ3RoID0gdGhpcy5sZW5ndGggfCAwXG4gIGlmIChsZW5ndGggPT09IDApIHJldHVybiAnJ1xuICBpZiAoYXJndW1lbnRzLmxlbmd0aCA9PT0gMCkgcmV0dXJuIHV0ZjhTbGljZSh0aGlzLCAwLCBsZW5ndGgpXG4gIHJldHVybiBzbG93VG9TdHJpbmcuYXBwbHkodGhpcywgYXJndW1lbnRzKVxufVxuXG5CdWZmZXIucHJvdG90eXBlLmVxdWFscyA9IGZ1bmN0aW9uIGVxdWFscyAoYikge1xuICBpZiAoIUJ1ZmZlci5pc0J1ZmZlcihiKSkgdGhyb3cgbmV3IFR5cGVFcnJvcignQXJndW1lbnQgbXVzdCBiZSBhIEJ1ZmZlcicpXG4gIGlmICh0aGlzID09PSBiKSByZXR1cm4gdHJ1ZVxuICByZXR1cm4gQnVmZmVyLmNvbXBhcmUodGhpcywgYikgPT09IDBcbn1cblxuQnVmZmVyLnByb3RvdHlwZS5pbnNwZWN0ID0gZnVuY3Rpb24gaW5zcGVjdCAoKSB7XG4gIHZhciBzdHIgPSAnJ1xuICB2YXIgbWF4ID0gZXhwb3J0cy5JTlNQRUNUX01BWF9CWVRFU1xuICBpZiAodGhpcy5sZW5ndGggPiAwKSB7XG4gICAgc3RyID0gdGhpcy50b1N0cmluZygnaGV4JywgMCwgbWF4KS5tYXRjaCgvLnsyfS9nKS5qb2luKCcgJylcbiAgICBpZiAodGhpcy5sZW5ndGggPiBtYXgpIHN0ciArPSAnIC4uLiAnXG4gIH1cbiAgcmV0dXJuICc8QnVmZmVyICcgKyBzdHIgKyAnPidcbn1cblxuQnVmZmVyLnByb3RvdHlwZS5jb21wYXJlID0gZnVuY3Rpb24gY29tcGFyZSAoYikge1xuICBpZiAoIUJ1ZmZlci5pc0J1ZmZlcihiKSkgdGhyb3cgbmV3IFR5cGVFcnJvcignQXJndW1lbnQgbXVzdCBiZSBhIEJ1ZmZlcicpXG4gIGlmICh0aGlzID09PSBiKSByZXR1cm4gMFxuICByZXR1cm4gQnVmZmVyLmNvbXBhcmUodGhpcywgYilcbn1cblxuQnVmZmVyLnByb3RvdHlwZS5pbmRleE9mID0gZnVuY3Rpb24gaW5kZXhPZiAodmFsLCBieXRlT2Zmc2V0KSB7XG4gIGlmIChieXRlT2Zmc2V0ID4gMHg3ZmZmZmZmZikgYnl0ZU9mZnNldCA9IDB4N2ZmZmZmZmZcbiAgZWxzZSBpZiAoYnl0ZU9mZnNldCA8IC0weDgwMDAwMDAwKSBieXRlT2Zmc2V0ID0gLTB4ODAwMDAwMDBcbiAgYnl0ZU9mZnNldCA+Pj0gMFxuXG4gIGlmICh0aGlzLmxlbmd0aCA9PT0gMCkgcmV0dXJuIC0xXG4gIGlmIChieXRlT2Zmc2V0ID49IHRoaXMubGVuZ3RoKSByZXR1cm4gLTFcblxuICAvLyBOZWdhdGl2ZSBvZmZzZXRzIHN0YXJ0IGZyb20gdGhlIGVuZCBvZiB0aGUgYnVmZmVyXG4gIGlmIChieXRlT2Zmc2V0IDwgMCkgYnl0ZU9mZnNldCA9IE1hdGgubWF4KHRoaXMubGVuZ3RoICsgYnl0ZU9mZnNldCwgMClcblxuICBpZiAodHlwZW9mIHZhbCA9PT0gJ3N0cmluZycpIHtcbiAgICBpZiAodmFsLmxlbmd0aCA9PT0gMCkgcmV0dXJuIC0xIC8vIHNwZWNpYWwgY2FzZTogbG9va2luZyBmb3IgZW1wdHkgc3RyaW5nIGFsd2F5cyBmYWlsc1xuICAgIHJldHVybiBTdHJpbmcucHJvdG90eXBlLmluZGV4T2YuY2FsbCh0aGlzLCB2YWwsIGJ5dGVPZmZzZXQpXG4gIH1cbiAgaWYgKEJ1ZmZlci5pc0J1ZmZlcih2YWwpKSB7XG4gICAgcmV0dXJuIGFycmF5SW5kZXhPZih0aGlzLCB2YWwsIGJ5dGVPZmZzZXQpXG4gIH1cbiAgaWYgKHR5cGVvZiB2YWwgPT09ICdudW1iZXInKSB7XG4gICAgaWYgKEJ1ZmZlci5UWVBFRF9BUlJBWV9TVVBQT1JUICYmIFVpbnQ4QXJyYXkucHJvdG90eXBlLmluZGV4T2YgPT09ICdmdW5jdGlvbicpIHtcbiAgICAgIHJldHVybiBVaW50OEFycmF5LnByb3RvdHlwZS5pbmRleE9mLmNhbGwodGhpcywgdmFsLCBieXRlT2Zmc2V0KVxuICAgIH1cbiAgICByZXR1cm4gYXJyYXlJbmRleE9mKHRoaXMsIFsgdmFsIF0sIGJ5dGVPZmZzZXQpXG4gIH1cblxuICBmdW5jdGlvbiBhcnJheUluZGV4T2YgKGFyciwgdmFsLCBieXRlT2Zmc2V0KSB7XG4gICAgdmFyIGZvdW5kSW5kZXggPSAtMVxuICAgIGZvciAodmFyIGkgPSAwOyBieXRlT2Zmc2V0ICsgaSA8IGFyci5sZW5ndGg7IGkrKykge1xuICAgICAgaWYgKGFycltieXRlT2Zmc2V0ICsgaV0gPT09IHZhbFtmb3VuZEluZGV4ID09PSAtMSA/IDAgOiBpIC0gZm91bmRJbmRleF0pIHtcbiAgICAgICAgaWYgKGZvdW5kSW5kZXggPT09IC0xKSBmb3VuZEluZGV4ID0gaVxuICAgICAgICBpZiAoaSAtIGZvdW5kSW5kZXggKyAxID09PSB2YWwubGVuZ3RoKSByZXR1cm4gYnl0ZU9mZnNldCArIGZvdW5kSW5kZXhcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIGZvdW5kSW5kZXggPSAtMVxuICAgICAgfVxuICAgIH1cbiAgICByZXR1cm4gLTFcbiAgfVxuXG4gIHRocm93IG5ldyBUeXBlRXJyb3IoJ3ZhbCBtdXN0IGJlIHN0cmluZywgbnVtYmVyIG9yIEJ1ZmZlcicpXG59XG5cbmZ1bmN0aW9uIGhleFdyaXRlIChidWYsIHN0cmluZywgb2Zmc2V0LCBsZW5ndGgpIHtcbiAgb2Zmc2V0ID0gTnVtYmVyKG9mZnNldCkgfHwgMFxuICB2YXIgcmVtYWluaW5nID0gYnVmLmxlbmd0aCAtIG9mZnNldFxuICBpZiAoIWxlbmd0aCkge1xuICAgIGxlbmd0aCA9IHJlbWFpbmluZ1xuICB9IGVsc2Uge1xuICAgIGxlbmd0aCA9IE51bWJlcihsZW5ndGgpXG4gICAgaWYgKGxlbmd0aCA+IHJlbWFpbmluZykge1xuICAgICAgbGVuZ3RoID0gcmVtYWluaW5nXG4gICAgfVxuICB9XG5cbiAgLy8gbXVzdCBiZSBhbiBldmVuIG51bWJlciBvZiBkaWdpdHNcbiAgdmFyIHN0ckxlbiA9IHN0cmluZy5sZW5ndGhcbiAgaWYgKHN0ckxlbiAlIDIgIT09IDApIHRocm93IG5ldyBFcnJvcignSW52YWxpZCBoZXggc3RyaW5nJylcblxuICBpZiAobGVuZ3RoID4gc3RyTGVuIC8gMikge1xuICAgIGxlbmd0aCA9IHN0ckxlbiAvIDJcbiAgfVxuICBmb3IgKHZhciBpID0gMDsgaSA8IGxlbmd0aDsgaSsrKSB7XG4gICAgdmFyIHBhcnNlZCA9IHBhcnNlSW50KHN0cmluZy5zdWJzdHIoaSAqIDIsIDIpLCAxNilcbiAgICBpZiAoaXNOYU4ocGFyc2VkKSkgdGhyb3cgbmV3IEVycm9yKCdJbnZhbGlkIGhleCBzdHJpbmcnKVxuICAgIGJ1ZltvZmZzZXQgKyBpXSA9IHBhcnNlZFxuICB9XG4gIHJldHVybiBpXG59XG5cbmZ1bmN0aW9uIHV0ZjhXcml0ZSAoYnVmLCBzdHJpbmcsIG9mZnNldCwgbGVuZ3RoKSB7XG4gIHJldHVybiBibGl0QnVmZmVyKHV0ZjhUb0J5dGVzKHN0cmluZywgYnVmLmxlbmd0aCAtIG9mZnNldCksIGJ1Ziwgb2Zmc2V0LCBsZW5ndGgpXG59XG5cbmZ1bmN0aW9uIGFzY2lpV3JpdGUgKGJ1Ziwgc3RyaW5nLCBvZmZzZXQsIGxlbmd0aCkge1xuICByZXR1cm4gYmxpdEJ1ZmZlcihhc2NpaVRvQnl0ZXMoc3RyaW5nKSwgYnVmLCBvZmZzZXQsIGxlbmd0aClcbn1cblxuZnVuY3Rpb24gYmluYXJ5V3JpdGUgKGJ1Ziwgc3RyaW5nLCBvZmZzZXQsIGxlbmd0aCkge1xuICByZXR1cm4gYXNjaWlXcml0ZShidWYsIHN0cmluZywgb2Zmc2V0LCBsZW5ndGgpXG59XG5cbmZ1bmN0aW9uIGJhc2U2NFdyaXRlIChidWYsIHN0cmluZywgb2Zmc2V0LCBsZW5ndGgpIHtcbiAgcmV0dXJuIGJsaXRCdWZmZXIoYmFzZTY0VG9CeXRlcyhzdHJpbmcpLCBidWYsIG9mZnNldCwgbGVuZ3RoKVxufVxuXG5mdW5jdGlvbiB1Y3MyV3JpdGUgKGJ1Ziwgc3RyaW5nLCBvZmZzZXQsIGxlbmd0aCkge1xuICByZXR1cm4gYmxpdEJ1ZmZlcih1dGYxNmxlVG9CeXRlcyhzdHJpbmcsIGJ1Zi5sZW5ndGggLSBvZmZzZXQpLCBidWYsIG9mZnNldCwgbGVuZ3RoKVxufVxuXG5CdWZmZXIucHJvdG90eXBlLndyaXRlID0gZnVuY3Rpb24gd3JpdGUgKHN0cmluZywgb2Zmc2V0LCBsZW5ndGgsIGVuY29kaW5nKSB7XG4gIC8vIEJ1ZmZlciN3cml0ZShzdHJpbmcpXG4gIGlmIChvZmZzZXQgPT09IHVuZGVmaW5lZCkge1xuICAgIGVuY29kaW5nID0gJ3V0ZjgnXG4gICAgbGVuZ3RoID0gdGhpcy5sZW5ndGhcbiAgICBvZmZzZXQgPSAwXG4gIC8vIEJ1ZmZlciN3cml0ZShzdHJpbmcsIGVuY29kaW5nKVxuICB9IGVsc2UgaWYgKGxlbmd0aCA9PT0gdW5kZWZpbmVkICYmIHR5cGVvZiBvZmZzZXQgPT09ICdzdHJpbmcnKSB7XG4gICAgZW5jb2RpbmcgPSBvZmZzZXRcbiAgICBsZW5ndGggPSB0aGlzLmxlbmd0aFxuICAgIG9mZnNldCA9IDBcbiAgLy8gQnVmZmVyI3dyaXRlKHN0cmluZywgb2Zmc2V0WywgbGVuZ3RoXVssIGVuY29kaW5nXSlcbiAgfSBlbHNlIGlmIChpc0Zpbml0ZShvZmZzZXQpKSB7XG4gICAgb2Zmc2V0ID0gb2Zmc2V0IHwgMFxuICAgIGlmIChpc0Zpbml0ZShsZW5ndGgpKSB7XG4gICAgICBsZW5ndGggPSBsZW5ndGggfCAwXG4gICAgICBpZiAoZW5jb2RpbmcgPT09IHVuZGVmaW5lZCkgZW5jb2RpbmcgPSAndXRmOCdcbiAgICB9IGVsc2Uge1xuICAgICAgZW5jb2RpbmcgPSBsZW5ndGhcbiAgICAgIGxlbmd0aCA9IHVuZGVmaW5lZFxuICAgIH1cbiAgLy8gbGVnYWN5IHdyaXRlKHN0cmluZywgZW5jb2RpbmcsIG9mZnNldCwgbGVuZ3RoKSAtIHJlbW92ZSBpbiB2MC4xM1xuICB9IGVsc2Uge1xuICAgIHZhciBzd2FwID0gZW5jb2RpbmdcbiAgICBlbmNvZGluZyA9IG9mZnNldFxuICAgIG9mZnNldCA9IGxlbmd0aCB8IDBcbiAgICBsZW5ndGggPSBzd2FwXG4gIH1cblxuICB2YXIgcmVtYWluaW5nID0gdGhpcy5sZW5ndGggLSBvZmZzZXRcbiAgaWYgKGxlbmd0aCA9PT0gdW5kZWZpbmVkIHx8IGxlbmd0aCA+IHJlbWFpbmluZykgbGVuZ3RoID0gcmVtYWluaW5nXG5cbiAgaWYgKChzdHJpbmcubGVuZ3RoID4gMCAmJiAobGVuZ3RoIDwgMCB8fCBvZmZzZXQgPCAwKSkgfHwgb2Zmc2V0ID4gdGhpcy5sZW5ndGgpIHtcbiAgICB0aHJvdyBuZXcgUmFuZ2VFcnJvcignYXR0ZW1wdCB0byB3cml0ZSBvdXRzaWRlIGJ1ZmZlciBib3VuZHMnKVxuICB9XG5cbiAgaWYgKCFlbmNvZGluZykgZW5jb2RpbmcgPSAndXRmOCdcblxuICB2YXIgbG93ZXJlZENhc2UgPSBmYWxzZVxuICBmb3IgKDs7KSB7XG4gICAgc3dpdGNoIChlbmNvZGluZykge1xuICAgICAgY2FzZSAnaGV4JzpcbiAgICAgICAgcmV0dXJuIGhleFdyaXRlKHRoaXMsIHN0cmluZywgb2Zmc2V0LCBsZW5ndGgpXG5cbiAgICAgIGNhc2UgJ3V0ZjgnOlxuICAgICAgY2FzZSAndXRmLTgnOlxuICAgICAgICByZXR1cm4gdXRmOFdyaXRlKHRoaXMsIHN0cmluZywgb2Zmc2V0LCBsZW5ndGgpXG5cbiAgICAgIGNhc2UgJ2FzY2lpJzpcbiAgICAgICAgcmV0dXJuIGFzY2lpV3JpdGUodGhpcywgc3RyaW5nLCBvZmZzZXQsIGxlbmd0aClcblxuICAgICAgY2FzZSAnYmluYXJ5JzpcbiAgICAgICAgcmV0dXJuIGJpbmFyeVdyaXRlKHRoaXMsIHN0cmluZywgb2Zmc2V0LCBsZW5ndGgpXG5cbiAgICAgIGNhc2UgJ2Jhc2U2NCc6XG4gICAgICAgIC8vIFdhcm5pbmc6IG1heExlbmd0aCBub3QgdGFrZW4gaW50byBhY2NvdW50IGluIGJhc2U2NFdyaXRlXG4gICAgICAgIHJldHVybiBiYXNlNjRXcml0ZSh0aGlzLCBzdHJpbmcsIG9mZnNldCwgbGVuZ3RoKVxuXG4gICAgICBjYXNlICd1Y3MyJzpcbiAgICAgIGNhc2UgJ3Vjcy0yJzpcbiAgICAgIGNhc2UgJ3V0ZjE2bGUnOlxuICAgICAgY2FzZSAndXRmLTE2bGUnOlxuICAgICAgICByZXR1cm4gdWNzMldyaXRlKHRoaXMsIHN0cmluZywgb2Zmc2V0LCBsZW5ndGgpXG5cbiAgICAgIGRlZmF1bHQ6XG4gICAgICAgIGlmIChsb3dlcmVkQ2FzZSkgdGhyb3cgbmV3IFR5cGVFcnJvcignVW5rbm93biBlbmNvZGluZzogJyArIGVuY29kaW5nKVxuICAgICAgICBlbmNvZGluZyA9ICgnJyArIGVuY29kaW5nKS50b0xvd2VyQ2FzZSgpXG4gICAgICAgIGxvd2VyZWRDYXNlID0gdHJ1ZVxuICAgIH1cbiAgfVxufVxuXG5CdWZmZXIucHJvdG90eXBlLnRvSlNPTiA9IGZ1bmN0aW9uIHRvSlNPTiAoKSB7XG4gIHJldHVybiB7XG4gICAgdHlwZTogJ0J1ZmZlcicsXG4gICAgZGF0YTogQXJyYXkucHJvdG90eXBlLnNsaWNlLmNhbGwodGhpcy5fYXJyIHx8IHRoaXMsIDApXG4gIH1cbn1cblxuZnVuY3Rpb24gYmFzZTY0U2xpY2UgKGJ1Ziwgc3RhcnQsIGVuZCkge1xuICBpZiAoc3RhcnQgPT09IDAgJiYgZW5kID09PSBidWYubGVuZ3RoKSB7XG4gICAgcmV0dXJuIGJhc2U2NC5mcm9tQnl0ZUFycmF5KGJ1ZilcbiAgfSBlbHNlIHtcbiAgICByZXR1cm4gYmFzZTY0LmZyb21CeXRlQXJyYXkoYnVmLnNsaWNlKHN0YXJ0LCBlbmQpKVxuICB9XG59XG5cbmZ1bmN0aW9uIHV0ZjhTbGljZSAoYnVmLCBzdGFydCwgZW5kKSB7XG4gIGVuZCA9IE1hdGgubWluKGJ1Zi5sZW5ndGgsIGVuZClcbiAgdmFyIHJlcyA9IFtdXG5cbiAgdmFyIGkgPSBzdGFydFxuICB3aGlsZSAoaSA8IGVuZCkge1xuICAgIHZhciBmaXJzdEJ5dGUgPSBidWZbaV1cbiAgICB2YXIgY29kZVBvaW50ID0gbnVsbFxuICAgIHZhciBieXRlc1BlclNlcXVlbmNlID0gKGZpcnN0Qnl0ZSA+IDB4RUYpID8gNFxuICAgICAgOiAoZmlyc3RCeXRlID4gMHhERikgPyAzXG4gICAgICA6IChmaXJzdEJ5dGUgPiAweEJGKSA/IDJcbiAgICAgIDogMVxuXG4gICAgaWYgKGkgKyBieXRlc1BlclNlcXVlbmNlIDw9IGVuZCkge1xuICAgICAgdmFyIHNlY29uZEJ5dGUsIHRoaXJkQnl0ZSwgZm91cnRoQnl0ZSwgdGVtcENvZGVQb2ludFxuXG4gICAgICBzd2l0Y2ggKGJ5dGVzUGVyU2VxdWVuY2UpIHtcbiAgICAgICAgY2FzZSAxOlxuICAgICAgICAgIGlmIChmaXJzdEJ5dGUgPCAweDgwKSB7XG4gICAgICAgICAgICBjb2RlUG9pbnQgPSBmaXJzdEJ5dGVcbiAgICAgICAgICB9XG4gICAgICAgICAgYnJlYWtcbiAgICAgICAgY2FzZSAyOlxuICAgICAgICAgIHNlY29uZEJ5dGUgPSBidWZbaSArIDFdXG4gICAgICAgICAgaWYgKChzZWNvbmRCeXRlICYgMHhDMCkgPT09IDB4ODApIHtcbiAgICAgICAgICAgIHRlbXBDb2RlUG9pbnQgPSAoZmlyc3RCeXRlICYgMHgxRikgPDwgMHg2IHwgKHNlY29uZEJ5dGUgJiAweDNGKVxuICAgICAgICAgICAgaWYgKHRlbXBDb2RlUG9pbnQgPiAweDdGKSB7XG4gICAgICAgICAgICAgIGNvZGVQb2ludCA9IHRlbXBDb2RlUG9pbnRcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9XG4gICAgICAgICAgYnJlYWtcbiAgICAgICAgY2FzZSAzOlxuICAgICAgICAgIHNlY29uZEJ5dGUgPSBidWZbaSArIDFdXG4gICAgICAgICAgdGhpcmRCeXRlID0gYnVmW2kgKyAyXVxuICAgICAgICAgIGlmICgoc2Vjb25kQnl0ZSAmIDB4QzApID09PSAweDgwICYmICh0aGlyZEJ5dGUgJiAweEMwKSA9PT0gMHg4MCkge1xuICAgICAgICAgICAgdGVtcENvZGVQb2ludCA9IChmaXJzdEJ5dGUgJiAweEYpIDw8IDB4QyB8IChzZWNvbmRCeXRlICYgMHgzRikgPDwgMHg2IHwgKHRoaXJkQnl0ZSAmIDB4M0YpXG4gICAgICAgICAgICBpZiAodGVtcENvZGVQb2ludCA+IDB4N0ZGICYmICh0ZW1wQ29kZVBvaW50IDwgMHhEODAwIHx8IHRlbXBDb2RlUG9pbnQgPiAweERGRkYpKSB7XG4gICAgICAgICAgICAgIGNvZGVQb2ludCA9IHRlbXBDb2RlUG9pbnRcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9XG4gICAgICAgICAgYnJlYWtcbiAgICAgICAgY2FzZSA0OlxuICAgICAgICAgIHNlY29uZEJ5dGUgPSBidWZbaSArIDFdXG4gICAgICAgICAgdGhpcmRCeXRlID0gYnVmW2kgKyAyXVxuICAgICAgICAgIGZvdXJ0aEJ5dGUgPSBidWZbaSArIDNdXG4gICAgICAgICAgaWYgKChzZWNvbmRCeXRlICYgMHhDMCkgPT09IDB4ODAgJiYgKHRoaXJkQnl0ZSAmIDB4QzApID09PSAweDgwICYmIChmb3VydGhCeXRlICYgMHhDMCkgPT09IDB4ODApIHtcbiAgICAgICAgICAgIHRlbXBDb2RlUG9pbnQgPSAoZmlyc3RCeXRlICYgMHhGKSA8PCAweDEyIHwgKHNlY29uZEJ5dGUgJiAweDNGKSA8PCAweEMgfCAodGhpcmRCeXRlICYgMHgzRikgPDwgMHg2IHwgKGZvdXJ0aEJ5dGUgJiAweDNGKVxuICAgICAgICAgICAgaWYgKHRlbXBDb2RlUG9pbnQgPiAweEZGRkYgJiYgdGVtcENvZGVQb2ludCA8IDB4MTEwMDAwKSB7XG4gICAgICAgICAgICAgIGNvZGVQb2ludCA9IHRlbXBDb2RlUG9pbnRcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuXG4gICAgaWYgKGNvZGVQb2ludCA9PT0gbnVsbCkge1xuICAgICAgLy8gd2UgZGlkIG5vdCBnZW5lcmF0ZSBhIHZhbGlkIGNvZGVQb2ludCBzbyBpbnNlcnQgYVxuICAgICAgLy8gcmVwbGFjZW1lbnQgY2hhciAoVStGRkZEKSBhbmQgYWR2YW5jZSBvbmx5IDEgYnl0ZVxuICAgICAgY29kZVBvaW50ID0gMHhGRkZEXG4gICAgICBieXRlc1BlclNlcXVlbmNlID0gMVxuICAgIH0gZWxzZSBpZiAoY29kZVBvaW50ID4gMHhGRkZGKSB7XG4gICAgICAvLyBlbmNvZGUgdG8gdXRmMTYgKHN1cnJvZ2F0ZSBwYWlyIGRhbmNlKVxuICAgICAgY29kZVBvaW50IC09IDB4MTAwMDBcbiAgICAgIHJlcy5wdXNoKGNvZGVQb2ludCA+Pj4gMTAgJiAweDNGRiB8IDB4RDgwMClcbiAgICAgIGNvZGVQb2ludCA9IDB4REMwMCB8IGNvZGVQb2ludCAmIDB4M0ZGXG4gICAgfVxuXG4gICAgcmVzLnB1c2goY29kZVBvaW50KVxuICAgIGkgKz0gYnl0ZXNQZXJTZXF1ZW5jZVxuICB9XG5cbiAgcmV0dXJuIGRlY29kZUNvZGVQb2ludHNBcnJheShyZXMpXG59XG5cbi8vIEJhc2VkIG9uIGh0dHA6Ly9zdGFja292ZXJmbG93LmNvbS9hLzIyNzQ3MjcyLzY4MDc0MiwgdGhlIGJyb3dzZXIgd2l0aFxuLy8gdGhlIGxvd2VzdCBsaW1pdCBpcyBDaHJvbWUsIHdpdGggMHgxMDAwMCBhcmdzLlxuLy8gV2UgZ28gMSBtYWduaXR1ZGUgbGVzcywgZm9yIHNhZmV0eVxudmFyIE1BWF9BUkdVTUVOVFNfTEVOR1RIID0gMHgxMDAwXG5cbmZ1bmN0aW9uIGRlY29kZUNvZGVQb2ludHNBcnJheSAoY29kZVBvaW50cykge1xuICB2YXIgbGVuID0gY29kZVBvaW50cy5sZW5ndGhcbiAgaWYgKGxlbiA8PSBNQVhfQVJHVU1FTlRTX0xFTkdUSCkge1xuICAgIHJldHVybiBTdHJpbmcuZnJvbUNoYXJDb2RlLmFwcGx5KFN0cmluZywgY29kZVBvaW50cykgLy8gYXZvaWQgZXh0cmEgc2xpY2UoKVxuICB9XG5cbiAgLy8gRGVjb2RlIGluIGNodW5rcyB0byBhdm9pZCBcImNhbGwgc3RhY2sgc2l6ZSBleGNlZWRlZFwiLlxuICB2YXIgcmVzID0gJydcbiAgdmFyIGkgPSAwXG4gIHdoaWxlIChpIDwgbGVuKSB7XG4gICAgcmVzICs9IFN0cmluZy5mcm9tQ2hhckNvZGUuYXBwbHkoXG4gICAgICBTdHJpbmcsXG4gICAgICBjb2RlUG9pbnRzLnNsaWNlKGksIGkgKz0gTUFYX0FSR1VNRU5UU19MRU5HVEgpXG4gICAgKVxuICB9XG4gIHJldHVybiByZXNcbn1cblxuZnVuY3Rpb24gYXNjaWlTbGljZSAoYnVmLCBzdGFydCwgZW5kKSB7XG4gIHZhciByZXQgPSAnJ1xuICBlbmQgPSBNYXRoLm1pbihidWYubGVuZ3RoLCBlbmQpXG5cbiAgZm9yICh2YXIgaSA9IHN0YXJ0OyBpIDwgZW5kOyBpKyspIHtcbiAgICByZXQgKz0gU3RyaW5nLmZyb21DaGFyQ29kZShidWZbaV0gJiAweDdGKVxuICB9XG4gIHJldHVybiByZXRcbn1cblxuZnVuY3Rpb24gYmluYXJ5U2xpY2UgKGJ1Ziwgc3RhcnQsIGVuZCkge1xuICB2YXIgcmV0ID0gJydcbiAgZW5kID0gTWF0aC5taW4oYnVmLmxlbmd0aCwgZW5kKVxuXG4gIGZvciAodmFyIGkgPSBzdGFydDsgaSA8IGVuZDsgaSsrKSB7XG4gICAgcmV0ICs9IFN0cmluZy5mcm9tQ2hhckNvZGUoYnVmW2ldKVxuICB9XG4gIHJldHVybiByZXRcbn1cblxuZnVuY3Rpb24gaGV4U2xpY2UgKGJ1Ziwgc3RhcnQsIGVuZCkge1xuICB2YXIgbGVuID0gYnVmLmxlbmd0aFxuXG4gIGlmICghc3RhcnQgfHwgc3RhcnQgPCAwKSBzdGFydCA9IDBcbiAgaWYgKCFlbmQgfHwgZW5kIDwgMCB8fCBlbmQgPiBsZW4pIGVuZCA9IGxlblxuXG4gIHZhciBvdXQgPSAnJ1xuICBmb3IgKHZhciBpID0gc3RhcnQ7IGkgPCBlbmQ7IGkrKykge1xuICAgIG91dCArPSB0b0hleChidWZbaV0pXG4gIH1cbiAgcmV0dXJuIG91dFxufVxuXG5mdW5jdGlvbiB1dGYxNmxlU2xpY2UgKGJ1Ziwgc3RhcnQsIGVuZCkge1xuICB2YXIgYnl0ZXMgPSBidWYuc2xpY2Uoc3RhcnQsIGVuZClcbiAgdmFyIHJlcyA9ICcnXG4gIGZvciAodmFyIGkgPSAwOyBpIDwgYnl0ZXMubGVuZ3RoOyBpICs9IDIpIHtcbiAgICByZXMgKz0gU3RyaW5nLmZyb21DaGFyQ29kZShieXRlc1tpXSArIGJ5dGVzW2kgKyAxXSAqIDI1NilcbiAgfVxuICByZXR1cm4gcmVzXG59XG5cbkJ1ZmZlci5wcm90b3R5cGUuc2xpY2UgPSBmdW5jdGlvbiBzbGljZSAoc3RhcnQsIGVuZCkge1xuICB2YXIgbGVuID0gdGhpcy5sZW5ndGhcbiAgc3RhcnQgPSB+fnN0YXJ0XG4gIGVuZCA9IGVuZCA9PT0gdW5kZWZpbmVkID8gbGVuIDogfn5lbmRcblxuICBpZiAoc3RhcnQgPCAwKSB7XG4gICAgc3RhcnQgKz0gbGVuXG4gICAgaWYgKHN0YXJ0IDwgMCkgc3RhcnQgPSAwXG4gIH0gZWxzZSBpZiAoc3RhcnQgPiBsZW4pIHtcbiAgICBzdGFydCA9IGxlblxuICB9XG5cbiAgaWYgKGVuZCA8IDApIHtcbiAgICBlbmQgKz0gbGVuXG4gICAgaWYgKGVuZCA8IDApIGVuZCA9IDBcbiAgfSBlbHNlIGlmIChlbmQgPiBsZW4pIHtcbiAgICBlbmQgPSBsZW5cbiAgfVxuXG4gIGlmIChlbmQgPCBzdGFydCkgZW5kID0gc3RhcnRcblxuICB2YXIgbmV3QnVmXG4gIGlmIChCdWZmZXIuVFlQRURfQVJSQVlfU1VQUE9SVCkge1xuICAgIG5ld0J1ZiA9IHRoaXMuc3ViYXJyYXkoc3RhcnQsIGVuZClcbiAgICBuZXdCdWYuX19wcm90b19fID0gQnVmZmVyLnByb3RvdHlwZVxuICB9IGVsc2Uge1xuICAgIHZhciBzbGljZUxlbiA9IGVuZCAtIHN0YXJ0XG4gICAgbmV3QnVmID0gbmV3IEJ1ZmZlcihzbGljZUxlbiwgdW5kZWZpbmVkKVxuICAgIGZvciAodmFyIGkgPSAwOyBpIDwgc2xpY2VMZW47IGkrKykge1xuICAgICAgbmV3QnVmW2ldID0gdGhpc1tpICsgc3RhcnRdXG4gICAgfVxuICB9XG5cbiAgaWYgKG5ld0J1Zi5sZW5ndGgpIG5ld0J1Zi5wYXJlbnQgPSB0aGlzLnBhcmVudCB8fCB0aGlzXG5cbiAgcmV0dXJuIG5ld0J1ZlxufVxuXG4vKlxuICogTmVlZCB0byBtYWtlIHN1cmUgdGhhdCBidWZmZXIgaXNuJ3QgdHJ5aW5nIHRvIHdyaXRlIG91dCBvZiBib3VuZHMuXG4gKi9cbmZ1bmN0aW9uIGNoZWNrT2Zmc2V0IChvZmZzZXQsIGV4dCwgbGVuZ3RoKSB7XG4gIGlmICgob2Zmc2V0ICUgMSkgIT09IDAgfHwgb2Zmc2V0IDwgMCkgdGhyb3cgbmV3IFJhbmdlRXJyb3IoJ29mZnNldCBpcyBub3QgdWludCcpXG4gIGlmIChvZmZzZXQgKyBleHQgPiBsZW5ndGgpIHRocm93IG5ldyBSYW5nZUVycm9yKCdUcnlpbmcgdG8gYWNjZXNzIGJleW9uZCBidWZmZXIgbGVuZ3RoJylcbn1cblxuQnVmZmVyLnByb3RvdHlwZS5yZWFkVUludExFID0gZnVuY3Rpb24gcmVhZFVJbnRMRSAob2Zmc2V0LCBieXRlTGVuZ3RoLCBub0Fzc2VydCkge1xuICBvZmZzZXQgPSBvZmZzZXQgfCAwXG4gIGJ5dGVMZW5ndGggPSBieXRlTGVuZ3RoIHwgMFxuICBpZiAoIW5vQXNzZXJ0KSBjaGVja09mZnNldChvZmZzZXQsIGJ5dGVMZW5ndGgsIHRoaXMubGVuZ3RoKVxuXG4gIHZhciB2YWwgPSB0aGlzW29mZnNldF1cbiAgdmFyIG11bCA9IDFcbiAgdmFyIGkgPSAwXG4gIHdoaWxlICgrK2kgPCBieXRlTGVuZ3RoICYmIChtdWwgKj0gMHgxMDApKSB7XG4gICAgdmFsICs9IHRoaXNbb2Zmc2V0ICsgaV0gKiBtdWxcbiAgfVxuXG4gIHJldHVybiB2YWxcbn1cblxuQnVmZmVyLnByb3RvdHlwZS5yZWFkVUludEJFID0gZnVuY3Rpb24gcmVhZFVJbnRCRSAob2Zmc2V0LCBieXRlTGVuZ3RoLCBub0Fzc2VydCkge1xuICBvZmZzZXQgPSBvZmZzZXQgfCAwXG4gIGJ5dGVMZW5ndGggPSBieXRlTGVuZ3RoIHwgMFxuICBpZiAoIW5vQXNzZXJ0KSB7XG4gICAgY2hlY2tPZmZzZXQob2Zmc2V0LCBieXRlTGVuZ3RoLCB0aGlzLmxlbmd0aClcbiAgfVxuXG4gIHZhciB2YWwgPSB0aGlzW29mZnNldCArIC0tYnl0ZUxlbmd0aF1cbiAgdmFyIG11bCA9IDFcbiAgd2hpbGUgKGJ5dGVMZW5ndGggPiAwICYmIChtdWwgKj0gMHgxMDApKSB7XG4gICAgdmFsICs9IHRoaXNbb2Zmc2V0ICsgLS1ieXRlTGVuZ3RoXSAqIG11bFxuICB9XG5cbiAgcmV0dXJuIHZhbFxufVxuXG5CdWZmZXIucHJvdG90eXBlLnJlYWRVSW50OCA9IGZ1bmN0aW9uIHJlYWRVSW50OCAob2Zmc2V0LCBub0Fzc2VydCkge1xuICBpZiAoIW5vQXNzZXJ0KSBjaGVja09mZnNldChvZmZzZXQsIDEsIHRoaXMubGVuZ3RoKVxuICByZXR1cm4gdGhpc1tvZmZzZXRdXG59XG5cbkJ1ZmZlci5wcm90b3R5cGUucmVhZFVJbnQxNkxFID0gZnVuY3Rpb24gcmVhZFVJbnQxNkxFIChvZmZzZXQsIG5vQXNzZXJ0KSB7XG4gIGlmICghbm9Bc3NlcnQpIGNoZWNrT2Zmc2V0KG9mZnNldCwgMiwgdGhpcy5sZW5ndGgpXG4gIHJldHVybiB0aGlzW29mZnNldF0gfCAodGhpc1tvZmZzZXQgKyAxXSA8PCA4KVxufVxuXG5CdWZmZXIucHJvdG90eXBlLnJlYWRVSW50MTZCRSA9IGZ1bmN0aW9uIHJlYWRVSW50MTZCRSAob2Zmc2V0LCBub0Fzc2VydCkge1xuICBpZiAoIW5vQXNzZXJ0KSBjaGVja09mZnNldChvZmZzZXQsIDIsIHRoaXMubGVuZ3RoKVxuICByZXR1cm4gKHRoaXNbb2Zmc2V0XSA8PCA4KSB8IHRoaXNbb2Zmc2V0ICsgMV1cbn1cblxuQnVmZmVyLnByb3RvdHlwZS5yZWFkVUludDMyTEUgPSBmdW5jdGlvbiByZWFkVUludDMyTEUgKG9mZnNldCwgbm9Bc3NlcnQpIHtcbiAgaWYgKCFub0Fzc2VydCkgY2hlY2tPZmZzZXQob2Zmc2V0LCA0LCB0aGlzLmxlbmd0aClcblxuICByZXR1cm4gKCh0aGlzW29mZnNldF0pIHxcbiAgICAgICh0aGlzW29mZnNldCArIDFdIDw8IDgpIHxcbiAgICAgICh0aGlzW29mZnNldCArIDJdIDw8IDE2KSkgK1xuICAgICAgKHRoaXNbb2Zmc2V0ICsgM10gKiAweDEwMDAwMDApXG59XG5cbkJ1ZmZlci5wcm90b3R5cGUucmVhZFVJbnQzMkJFID0gZnVuY3Rpb24gcmVhZFVJbnQzMkJFIChvZmZzZXQsIG5vQXNzZXJ0KSB7XG4gIGlmICghbm9Bc3NlcnQpIGNoZWNrT2Zmc2V0KG9mZnNldCwgNCwgdGhpcy5sZW5ndGgpXG5cbiAgcmV0dXJuICh0aGlzW29mZnNldF0gKiAweDEwMDAwMDApICtcbiAgICAoKHRoaXNbb2Zmc2V0ICsgMV0gPDwgMTYpIHxcbiAgICAodGhpc1tvZmZzZXQgKyAyXSA8PCA4KSB8XG4gICAgdGhpc1tvZmZzZXQgKyAzXSlcbn1cblxuQnVmZmVyLnByb3RvdHlwZS5yZWFkSW50TEUgPSBmdW5jdGlvbiByZWFkSW50TEUgKG9mZnNldCwgYnl0ZUxlbmd0aCwgbm9Bc3NlcnQpIHtcbiAgb2Zmc2V0ID0gb2Zmc2V0IHwgMFxuICBieXRlTGVuZ3RoID0gYnl0ZUxlbmd0aCB8IDBcbiAgaWYgKCFub0Fzc2VydCkgY2hlY2tPZmZzZXQob2Zmc2V0LCBieXRlTGVuZ3RoLCB0aGlzLmxlbmd0aClcblxuICB2YXIgdmFsID0gdGhpc1tvZmZzZXRdXG4gIHZhciBtdWwgPSAxXG4gIHZhciBpID0gMFxuICB3aGlsZSAoKytpIDwgYnl0ZUxlbmd0aCAmJiAobXVsICo9IDB4MTAwKSkge1xuICAgIHZhbCArPSB0aGlzW29mZnNldCArIGldICogbXVsXG4gIH1cbiAgbXVsICo9IDB4ODBcblxuICBpZiAodmFsID49IG11bCkgdmFsIC09IE1hdGgucG93KDIsIDggKiBieXRlTGVuZ3RoKVxuXG4gIHJldHVybiB2YWxcbn1cblxuQnVmZmVyLnByb3RvdHlwZS5yZWFkSW50QkUgPSBmdW5jdGlvbiByZWFkSW50QkUgKG9mZnNldCwgYnl0ZUxlbmd0aCwgbm9Bc3NlcnQpIHtcbiAgb2Zmc2V0ID0gb2Zmc2V0IHwgMFxuICBieXRlTGVuZ3RoID0gYnl0ZUxlbmd0aCB8IDBcbiAgaWYgKCFub0Fzc2VydCkgY2hlY2tPZmZzZXQob2Zmc2V0LCBieXRlTGVuZ3RoLCB0aGlzLmxlbmd0aClcblxuICB2YXIgaSA9IGJ5dGVMZW5ndGhcbiAgdmFyIG11bCA9IDFcbiAgdmFyIHZhbCA9IHRoaXNbb2Zmc2V0ICsgLS1pXVxuICB3aGlsZSAoaSA+IDAgJiYgKG11bCAqPSAweDEwMCkpIHtcbiAgICB2YWwgKz0gdGhpc1tvZmZzZXQgKyAtLWldICogbXVsXG4gIH1cbiAgbXVsICo9IDB4ODBcblxuICBpZiAodmFsID49IG11bCkgdmFsIC09IE1hdGgucG93KDIsIDggKiBieXRlTGVuZ3RoKVxuXG4gIHJldHVybiB2YWxcbn1cblxuQnVmZmVyLnByb3RvdHlwZS5yZWFkSW50OCA9IGZ1bmN0aW9uIHJlYWRJbnQ4IChvZmZzZXQsIG5vQXNzZXJ0KSB7XG4gIGlmICghbm9Bc3NlcnQpIGNoZWNrT2Zmc2V0KG9mZnNldCwgMSwgdGhpcy5sZW5ndGgpXG4gIGlmICghKHRoaXNbb2Zmc2V0XSAmIDB4ODApKSByZXR1cm4gKHRoaXNbb2Zmc2V0XSlcbiAgcmV0dXJuICgoMHhmZiAtIHRoaXNbb2Zmc2V0XSArIDEpICogLTEpXG59XG5cbkJ1ZmZlci5wcm90b3R5cGUucmVhZEludDE2TEUgPSBmdW5jdGlvbiByZWFkSW50MTZMRSAob2Zmc2V0LCBub0Fzc2VydCkge1xuICBpZiAoIW5vQXNzZXJ0KSBjaGVja09mZnNldChvZmZzZXQsIDIsIHRoaXMubGVuZ3RoKVxuICB2YXIgdmFsID0gdGhpc1tvZmZzZXRdIHwgKHRoaXNbb2Zmc2V0ICsgMV0gPDwgOClcbiAgcmV0dXJuICh2YWwgJiAweDgwMDApID8gdmFsIHwgMHhGRkZGMDAwMCA6IHZhbFxufVxuXG5CdWZmZXIucHJvdG90eXBlLnJlYWRJbnQxNkJFID0gZnVuY3Rpb24gcmVhZEludDE2QkUgKG9mZnNldCwgbm9Bc3NlcnQpIHtcbiAgaWYgKCFub0Fzc2VydCkgY2hlY2tPZmZzZXQob2Zmc2V0LCAyLCB0aGlzLmxlbmd0aClcbiAgdmFyIHZhbCA9IHRoaXNbb2Zmc2V0ICsgMV0gfCAodGhpc1tvZmZzZXRdIDw8IDgpXG4gIHJldHVybiAodmFsICYgMHg4MDAwKSA/IHZhbCB8IDB4RkZGRjAwMDAgOiB2YWxcbn1cblxuQnVmZmVyLnByb3RvdHlwZS5yZWFkSW50MzJMRSA9IGZ1bmN0aW9uIHJlYWRJbnQzMkxFIChvZmZzZXQsIG5vQXNzZXJ0KSB7XG4gIGlmICghbm9Bc3NlcnQpIGNoZWNrT2Zmc2V0KG9mZnNldCwgNCwgdGhpcy5sZW5ndGgpXG5cbiAgcmV0dXJuICh0aGlzW29mZnNldF0pIHxcbiAgICAodGhpc1tvZmZzZXQgKyAxXSA8PCA4KSB8XG4gICAgKHRoaXNbb2Zmc2V0ICsgMl0gPDwgMTYpIHxcbiAgICAodGhpc1tvZmZzZXQgKyAzXSA8PCAyNClcbn1cblxuQnVmZmVyLnByb3RvdHlwZS5yZWFkSW50MzJCRSA9IGZ1bmN0aW9uIHJlYWRJbnQzMkJFIChvZmZzZXQsIG5vQXNzZXJ0KSB7XG4gIGlmICghbm9Bc3NlcnQpIGNoZWNrT2Zmc2V0KG9mZnNldCwgNCwgdGhpcy5sZW5ndGgpXG5cbiAgcmV0dXJuICh0aGlzW29mZnNldF0gPDwgMjQpIHxcbiAgICAodGhpc1tvZmZzZXQgKyAxXSA8PCAxNikgfFxuICAgICh0aGlzW29mZnNldCArIDJdIDw8IDgpIHxcbiAgICAodGhpc1tvZmZzZXQgKyAzXSlcbn1cblxuQnVmZmVyLnByb3RvdHlwZS5yZWFkRmxvYXRMRSA9IGZ1bmN0aW9uIHJlYWRGbG9hdExFIChvZmZzZXQsIG5vQXNzZXJ0KSB7XG4gIGlmICghbm9Bc3NlcnQpIGNoZWNrT2Zmc2V0KG9mZnNldCwgNCwgdGhpcy5sZW5ndGgpXG4gIHJldHVybiBpZWVlNzU0LnJlYWQodGhpcywgb2Zmc2V0LCB0cnVlLCAyMywgNClcbn1cblxuQnVmZmVyLnByb3RvdHlwZS5yZWFkRmxvYXRCRSA9IGZ1bmN0aW9uIHJlYWRGbG9hdEJFIChvZmZzZXQsIG5vQXNzZXJ0KSB7XG4gIGlmICghbm9Bc3NlcnQpIGNoZWNrT2Zmc2V0KG9mZnNldCwgNCwgdGhpcy5sZW5ndGgpXG4gIHJldHVybiBpZWVlNzU0LnJlYWQodGhpcywgb2Zmc2V0LCBmYWxzZSwgMjMsIDQpXG59XG5cbkJ1ZmZlci5wcm90b3R5cGUucmVhZERvdWJsZUxFID0gZnVuY3Rpb24gcmVhZERvdWJsZUxFIChvZmZzZXQsIG5vQXNzZXJ0KSB7XG4gIGlmICghbm9Bc3NlcnQpIGNoZWNrT2Zmc2V0KG9mZnNldCwgOCwgdGhpcy5sZW5ndGgpXG4gIHJldHVybiBpZWVlNzU0LnJlYWQodGhpcywgb2Zmc2V0LCB0cnVlLCA1MiwgOClcbn1cblxuQnVmZmVyLnByb3RvdHlwZS5yZWFkRG91YmxlQkUgPSBmdW5jdGlvbiByZWFkRG91YmxlQkUgKG9mZnNldCwgbm9Bc3NlcnQpIHtcbiAgaWYgKCFub0Fzc2VydCkgY2hlY2tPZmZzZXQob2Zmc2V0LCA4LCB0aGlzLmxlbmd0aClcbiAgcmV0dXJuIGllZWU3NTQucmVhZCh0aGlzLCBvZmZzZXQsIGZhbHNlLCA1MiwgOClcbn1cblxuZnVuY3Rpb24gY2hlY2tJbnQgKGJ1ZiwgdmFsdWUsIG9mZnNldCwgZXh0LCBtYXgsIG1pbikge1xuICBpZiAoIUJ1ZmZlci5pc0J1ZmZlcihidWYpKSB0aHJvdyBuZXcgVHlwZUVycm9yKCdidWZmZXIgbXVzdCBiZSBhIEJ1ZmZlciBpbnN0YW5jZScpXG4gIGlmICh2YWx1ZSA+IG1heCB8fCB2YWx1ZSA8IG1pbikgdGhyb3cgbmV3IFJhbmdlRXJyb3IoJ3ZhbHVlIGlzIG91dCBvZiBib3VuZHMnKVxuICBpZiAob2Zmc2V0ICsgZXh0ID4gYnVmLmxlbmd0aCkgdGhyb3cgbmV3IFJhbmdlRXJyb3IoJ2luZGV4IG91dCBvZiByYW5nZScpXG59XG5cbkJ1ZmZlci5wcm90b3R5cGUud3JpdGVVSW50TEUgPSBmdW5jdGlvbiB3cml0ZVVJbnRMRSAodmFsdWUsIG9mZnNldCwgYnl0ZUxlbmd0aCwgbm9Bc3NlcnQpIHtcbiAgdmFsdWUgPSArdmFsdWVcbiAgb2Zmc2V0ID0gb2Zmc2V0IHwgMFxuICBieXRlTGVuZ3RoID0gYnl0ZUxlbmd0aCB8IDBcbiAgaWYgKCFub0Fzc2VydCkgY2hlY2tJbnQodGhpcywgdmFsdWUsIG9mZnNldCwgYnl0ZUxlbmd0aCwgTWF0aC5wb3coMiwgOCAqIGJ5dGVMZW5ndGgpLCAwKVxuXG4gIHZhciBtdWwgPSAxXG4gIHZhciBpID0gMFxuICB0aGlzW29mZnNldF0gPSB2YWx1ZSAmIDB4RkZcbiAgd2hpbGUgKCsraSA8IGJ5dGVMZW5ndGggJiYgKG11bCAqPSAweDEwMCkpIHtcbiAgICB0aGlzW29mZnNldCArIGldID0gKHZhbHVlIC8gbXVsKSAmIDB4RkZcbiAgfVxuXG4gIHJldHVybiBvZmZzZXQgKyBieXRlTGVuZ3RoXG59XG5cbkJ1ZmZlci5wcm90b3R5cGUud3JpdGVVSW50QkUgPSBmdW5jdGlvbiB3cml0ZVVJbnRCRSAodmFsdWUsIG9mZnNldCwgYnl0ZUxlbmd0aCwgbm9Bc3NlcnQpIHtcbiAgdmFsdWUgPSArdmFsdWVcbiAgb2Zmc2V0ID0gb2Zmc2V0IHwgMFxuICBieXRlTGVuZ3RoID0gYnl0ZUxlbmd0aCB8IDBcbiAgaWYgKCFub0Fzc2VydCkgY2hlY2tJbnQodGhpcywgdmFsdWUsIG9mZnNldCwgYnl0ZUxlbmd0aCwgTWF0aC5wb3coMiwgOCAqIGJ5dGVMZW5ndGgpLCAwKVxuXG4gIHZhciBpID0gYnl0ZUxlbmd0aCAtIDFcbiAgdmFyIG11bCA9IDFcbiAgdGhpc1tvZmZzZXQgKyBpXSA9IHZhbHVlICYgMHhGRlxuICB3aGlsZSAoLS1pID49IDAgJiYgKG11bCAqPSAweDEwMCkpIHtcbiAgICB0aGlzW29mZnNldCArIGldID0gKHZhbHVlIC8gbXVsKSAmIDB4RkZcbiAgfVxuXG4gIHJldHVybiBvZmZzZXQgKyBieXRlTGVuZ3RoXG59XG5cbkJ1ZmZlci5wcm90b3R5cGUud3JpdGVVSW50OCA9IGZ1bmN0aW9uIHdyaXRlVUludDggKHZhbHVlLCBvZmZzZXQsIG5vQXNzZXJ0KSB7XG4gIHZhbHVlID0gK3ZhbHVlXG4gIG9mZnNldCA9IG9mZnNldCB8IDBcbiAgaWYgKCFub0Fzc2VydCkgY2hlY2tJbnQodGhpcywgdmFsdWUsIG9mZnNldCwgMSwgMHhmZiwgMClcbiAgaWYgKCFCdWZmZXIuVFlQRURfQVJSQVlfU1VQUE9SVCkgdmFsdWUgPSBNYXRoLmZsb29yKHZhbHVlKVxuICB0aGlzW29mZnNldF0gPSAodmFsdWUgJiAweGZmKVxuICByZXR1cm4gb2Zmc2V0ICsgMVxufVxuXG5mdW5jdGlvbiBvYmplY3RXcml0ZVVJbnQxNiAoYnVmLCB2YWx1ZSwgb2Zmc2V0LCBsaXR0bGVFbmRpYW4pIHtcbiAgaWYgKHZhbHVlIDwgMCkgdmFsdWUgPSAweGZmZmYgKyB2YWx1ZSArIDFcbiAgZm9yICh2YXIgaSA9IDAsIGogPSBNYXRoLm1pbihidWYubGVuZ3RoIC0gb2Zmc2V0LCAyKTsgaSA8IGo7IGkrKykge1xuICAgIGJ1ZltvZmZzZXQgKyBpXSA9ICh2YWx1ZSAmICgweGZmIDw8ICg4ICogKGxpdHRsZUVuZGlhbiA/IGkgOiAxIC0gaSkpKSkgPj4+XG4gICAgICAobGl0dGxlRW5kaWFuID8gaSA6IDEgLSBpKSAqIDhcbiAgfVxufVxuXG5CdWZmZXIucHJvdG90eXBlLndyaXRlVUludDE2TEUgPSBmdW5jdGlvbiB3cml0ZVVJbnQxNkxFICh2YWx1ZSwgb2Zmc2V0LCBub0Fzc2VydCkge1xuICB2YWx1ZSA9ICt2YWx1ZVxuICBvZmZzZXQgPSBvZmZzZXQgfCAwXG4gIGlmICghbm9Bc3NlcnQpIGNoZWNrSW50KHRoaXMsIHZhbHVlLCBvZmZzZXQsIDIsIDB4ZmZmZiwgMClcbiAgaWYgKEJ1ZmZlci5UWVBFRF9BUlJBWV9TVVBQT1JUKSB7XG4gICAgdGhpc1tvZmZzZXRdID0gKHZhbHVlICYgMHhmZilcbiAgICB0aGlzW29mZnNldCArIDFdID0gKHZhbHVlID4+PiA4KVxuICB9IGVsc2Uge1xuICAgIG9iamVjdFdyaXRlVUludDE2KHRoaXMsIHZhbHVlLCBvZmZzZXQsIHRydWUpXG4gIH1cbiAgcmV0dXJuIG9mZnNldCArIDJcbn1cblxuQnVmZmVyLnByb3RvdHlwZS53cml0ZVVJbnQxNkJFID0gZnVuY3Rpb24gd3JpdGVVSW50MTZCRSAodmFsdWUsIG9mZnNldCwgbm9Bc3NlcnQpIHtcbiAgdmFsdWUgPSArdmFsdWVcbiAgb2Zmc2V0ID0gb2Zmc2V0IHwgMFxuICBpZiAoIW5vQXNzZXJ0KSBjaGVja0ludCh0aGlzLCB2YWx1ZSwgb2Zmc2V0LCAyLCAweGZmZmYsIDApXG4gIGlmIChCdWZmZXIuVFlQRURfQVJSQVlfU1VQUE9SVCkge1xuICAgIHRoaXNbb2Zmc2V0XSA9ICh2YWx1ZSA+Pj4gOClcbiAgICB0aGlzW29mZnNldCArIDFdID0gKHZhbHVlICYgMHhmZilcbiAgfSBlbHNlIHtcbiAgICBvYmplY3RXcml0ZVVJbnQxNih0aGlzLCB2YWx1ZSwgb2Zmc2V0LCBmYWxzZSlcbiAgfVxuICByZXR1cm4gb2Zmc2V0ICsgMlxufVxuXG5mdW5jdGlvbiBvYmplY3RXcml0ZVVJbnQzMiAoYnVmLCB2YWx1ZSwgb2Zmc2V0LCBsaXR0bGVFbmRpYW4pIHtcbiAgaWYgKHZhbHVlIDwgMCkgdmFsdWUgPSAweGZmZmZmZmZmICsgdmFsdWUgKyAxXG4gIGZvciAodmFyIGkgPSAwLCBqID0gTWF0aC5taW4oYnVmLmxlbmd0aCAtIG9mZnNldCwgNCk7IGkgPCBqOyBpKyspIHtcbiAgICBidWZbb2Zmc2V0ICsgaV0gPSAodmFsdWUgPj4+IChsaXR0bGVFbmRpYW4gPyBpIDogMyAtIGkpICogOCkgJiAweGZmXG4gIH1cbn1cblxuQnVmZmVyLnByb3RvdHlwZS53cml0ZVVJbnQzMkxFID0gZnVuY3Rpb24gd3JpdGVVSW50MzJMRSAodmFsdWUsIG9mZnNldCwgbm9Bc3NlcnQpIHtcbiAgdmFsdWUgPSArdmFsdWVcbiAgb2Zmc2V0ID0gb2Zmc2V0IHwgMFxuICBpZiAoIW5vQXNzZXJ0KSBjaGVja0ludCh0aGlzLCB2YWx1ZSwgb2Zmc2V0LCA0LCAweGZmZmZmZmZmLCAwKVxuICBpZiAoQnVmZmVyLlRZUEVEX0FSUkFZX1NVUFBPUlQpIHtcbiAgICB0aGlzW29mZnNldCArIDNdID0gKHZhbHVlID4+PiAyNClcbiAgICB0aGlzW29mZnNldCArIDJdID0gKHZhbHVlID4+PiAxNilcbiAgICB0aGlzW29mZnNldCArIDFdID0gKHZhbHVlID4+PiA4KVxuICAgIHRoaXNbb2Zmc2V0XSA9ICh2YWx1ZSAmIDB4ZmYpXG4gIH0gZWxzZSB7XG4gICAgb2JqZWN0V3JpdGVVSW50MzIodGhpcywgdmFsdWUsIG9mZnNldCwgdHJ1ZSlcbiAgfVxuICByZXR1cm4gb2Zmc2V0ICsgNFxufVxuXG5CdWZmZXIucHJvdG90eXBlLndyaXRlVUludDMyQkUgPSBmdW5jdGlvbiB3cml0ZVVJbnQzMkJFICh2YWx1ZSwgb2Zmc2V0LCBub0Fzc2VydCkge1xuICB2YWx1ZSA9ICt2YWx1ZVxuICBvZmZzZXQgPSBvZmZzZXQgfCAwXG4gIGlmICghbm9Bc3NlcnQpIGNoZWNrSW50KHRoaXMsIHZhbHVlLCBvZmZzZXQsIDQsIDB4ZmZmZmZmZmYsIDApXG4gIGlmIChCdWZmZXIuVFlQRURfQVJSQVlfU1VQUE9SVCkge1xuICAgIHRoaXNbb2Zmc2V0XSA9ICh2YWx1ZSA+Pj4gMjQpXG4gICAgdGhpc1tvZmZzZXQgKyAxXSA9ICh2YWx1ZSA+Pj4gMTYpXG4gICAgdGhpc1tvZmZzZXQgKyAyXSA9ICh2YWx1ZSA+Pj4gOClcbiAgICB0aGlzW29mZnNldCArIDNdID0gKHZhbHVlICYgMHhmZilcbiAgfSBlbHNlIHtcbiAgICBvYmplY3RXcml0ZVVJbnQzMih0aGlzLCB2YWx1ZSwgb2Zmc2V0LCBmYWxzZSlcbiAgfVxuICByZXR1cm4gb2Zmc2V0ICsgNFxufVxuXG5CdWZmZXIucHJvdG90eXBlLndyaXRlSW50TEUgPSBmdW5jdGlvbiB3cml0ZUludExFICh2YWx1ZSwgb2Zmc2V0LCBieXRlTGVuZ3RoLCBub0Fzc2VydCkge1xuICB2YWx1ZSA9ICt2YWx1ZVxuICBvZmZzZXQgPSBvZmZzZXQgfCAwXG4gIGlmICghbm9Bc3NlcnQpIHtcbiAgICB2YXIgbGltaXQgPSBNYXRoLnBvdygyLCA4ICogYnl0ZUxlbmd0aCAtIDEpXG5cbiAgICBjaGVja0ludCh0aGlzLCB2YWx1ZSwgb2Zmc2V0LCBieXRlTGVuZ3RoLCBsaW1pdCAtIDEsIC1saW1pdClcbiAgfVxuXG4gIHZhciBpID0gMFxuICB2YXIgbXVsID0gMVxuICB2YXIgc3ViID0gdmFsdWUgPCAwID8gMSA6IDBcbiAgdGhpc1tvZmZzZXRdID0gdmFsdWUgJiAweEZGXG4gIHdoaWxlICgrK2kgPCBieXRlTGVuZ3RoICYmIChtdWwgKj0gMHgxMDApKSB7XG4gICAgdGhpc1tvZmZzZXQgKyBpXSA9ICgodmFsdWUgLyBtdWwpID4+IDApIC0gc3ViICYgMHhGRlxuICB9XG5cbiAgcmV0dXJuIG9mZnNldCArIGJ5dGVMZW5ndGhcbn1cblxuQnVmZmVyLnByb3RvdHlwZS53cml0ZUludEJFID0gZnVuY3Rpb24gd3JpdGVJbnRCRSAodmFsdWUsIG9mZnNldCwgYnl0ZUxlbmd0aCwgbm9Bc3NlcnQpIHtcbiAgdmFsdWUgPSArdmFsdWVcbiAgb2Zmc2V0ID0gb2Zmc2V0IHwgMFxuICBpZiAoIW5vQXNzZXJ0KSB7XG4gICAgdmFyIGxpbWl0ID0gTWF0aC5wb3coMiwgOCAqIGJ5dGVMZW5ndGggLSAxKVxuXG4gICAgY2hlY2tJbnQodGhpcywgdmFsdWUsIG9mZnNldCwgYnl0ZUxlbmd0aCwgbGltaXQgLSAxLCAtbGltaXQpXG4gIH1cblxuICB2YXIgaSA9IGJ5dGVMZW5ndGggLSAxXG4gIHZhciBtdWwgPSAxXG4gIHZhciBzdWIgPSB2YWx1ZSA8IDAgPyAxIDogMFxuICB0aGlzW29mZnNldCArIGldID0gdmFsdWUgJiAweEZGXG4gIHdoaWxlICgtLWkgPj0gMCAmJiAobXVsICo9IDB4MTAwKSkge1xuICAgIHRoaXNbb2Zmc2V0ICsgaV0gPSAoKHZhbHVlIC8gbXVsKSA+PiAwKSAtIHN1YiAmIDB4RkZcbiAgfVxuXG4gIHJldHVybiBvZmZzZXQgKyBieXRlTGVuZ3RoXG59XG5cbkJ1ZmZlci5wcm90b3R5cGUud3JpdGVJbnQ4ID0gZnVuY3Rpb24gd3JpdGVJbnQ4ICh2YWx1ZSwgb2Zmc2V0LCBub0Fzc2VydCkge1xuICB2YWx1ZSA9ICt2YWx1ZVxuICBvZmZzZXQgPSBvZmZzZXQgfCAwXG4gIGlmICghbm9Bc3NlcnQpIGNoZWNrSW50KHRoaXMsIHZhbHVlLCBvZmZzZXQsIDEsIDB4N2YsIC0weDgwKVxuICBpZiAoIUJ1ZmZlci5UWVBFRF9BUlJBWV9TVVBQT1JUKSB2YWx1ZSA9IE1hdGguZmxvb3IodmFsdWUpXG4gIGlmICh2YWx1ZSA8IDApIHZhbHVlID0gMHhmZiArIHZhbHVlICsgMVxuICB0aGlzW29mZnNldF0gPSAodmFsdWUgJiAweGZmKVxuICByZXR1cm4gb2Zmc2V0ICsgMVxufVxuXG5CdWZmZXIucHJvdG90eXBlLndyaXRlSW50MTZMRSA9IGZ1bmN0aW9uIHdyaXRlSW50MTZMRSAodmFsdWUsIG9mZnNldCwgbm9Bc3NlcnQpIHtcbiAgdmFsdWUgPSArdmFsdWVcbiAgb2Zmc2V0ID0gb2Zmc2V0IHwgMFxuICBpZiAoIW5vQXNzZXJ0KSBjaGVja0ludCh0aGlzLCB2YWx1ZSwgb2Zmc2V0LCAyLCAweDdmZmYsIC0weDgwMDApXG4gIGlmIChCdWZmZXIuVFlQRURfQVJSQVlfU1VQUE9SVCkge1xuICAgIHRoaXNbb2Zmc2V0XSA9ICh2YWx1ZSAmIDB4ZmYpXG4gICAgdGhpc1tvZmZzZXQgKyAxXSA9ICh2YWx1ZSA+Pj4gOClcbiAgfSBlbHNlIHtcbiAgICBvYmplY3RXcml0ZVVJbnQxNih0aGlzLCB2YWx1ZSwgb2Zmc2V0LCB0cnVlKVxuICB9XG4gIHJldHVybiBvZmZzZXQgKyAyXG59XG5cbkJ1ZmZlci5wcm90b3R5cGUud3JpdGVJbnQxNkJFID0gZnVuY3Rpb24gd3JpdGVJbnQxNkJFICh2YWx1ZSwgb2Zmc2V0LCBub0Fzc2VydCkge1xuICB2YWx1ZSA9ICt2YWx1ZVxuICBvZmZzZXQgPSBvZmZzZXQgfCAwXG4gIGlmICghbm9Bc3NlcnQpIGNoZWNrSW50KHRoaXMsIHZhbHVlLCBvZmZzZXQsIDIsIDB4N2ZmZiwgLTB4ODAwMClcbiAgaWYgKEJ1ZmZlci5UWVBFRF9BUlJBWV9TVVBQT1JUKSB7XG4gICAgdGhpc1tvZmZzZXRdID0gKHZhbHVlID4+PiA4KVxuICAgIHRoaXNbb2Zmc2V0ICsgMV0gPSAodmFsdWUgJiAweGZmKVxuICB9IGVsc2Uge1xuICAgIG9iamVjdFdyaXRlVUludDE2KHRoaXMsIHZhbHVlLCBvZmZzZXQsIGZhbHNlKVxuICB9XG4gIHJldHVybiBvZmZzZXQgKyAyXG59XG5cbkJ1ZmZlci5wcm90b3R5cGUud3JpdGVJbnQzMkxFID0gZnVuY3Rpb24gd3JpdGVJbnQzMkxFICh2YWx1ZSwgb2Zmc2V0LCBub0Fzc2VydCkge1xuICB2YWx1ZSA9ICt2YWx1ZVxuICBvZmZzZXQgPSBvZmZzZXQgfCAwXG4gIGlmICghbm9Bc3NlcnQpIGNoZWNrSW50KHRoaXMsIHZhbHVlLCBvZmZzZXQsIDQsIDB4N2ZmZmZmZmYsIC0weDgwMDAwMDAwKVxuICBpZiAoQnVmZmVyLlRZUEVEX0FSUkFZX1NVUFBPUlQpIHtcbiAgICB0aGlzW29mZnNldF0gPSAodmFsdWUgJiAweGZmKVxuICAgIHRoaXNbb2Zmc2V0ICsgMV0gPSAodmFsdWUgPj4+IDgpXG4gICAgdGhpc1tvZmZzZXQgKyAyXSA9ICh2YWx1ZSA+Pj4gMTYpXG4gICAgdGhpc1tvZmZzZXQgKyAzXSA9ICh2YWx1ZSA+Pj4gMjQpXG4gIH0gZWxzZSB7XG4gICAgb2JqZWN0V3JpdGVVSW50MzIodGhpcywgdmFsdWUsIG9mZnNldCwgdHJ1ZSlcbiAgfVxuICByZXR1cm4gb2Zmc2V0ICsgNFxufVxuXG5CdWZmZXIucHJvdG90eXBlLndyaXRlSW50MzJCRSA9IGZ1bmN0aW9uIHdyaXRlSW50MzJCRSAodmFsdWUsIG9mZnNldCwgbm9Bc3NlcnQpIHtcbiAgdmFsdWUgPSArdmFsdWVcbiAgb2Zmc2V0ID0gb2Zmc2V0IHwgMFxuICBpZiAoIW5vQXNzZXJ0KSBjaGVja0ludCh0aGlzLCB2YWx1ZSwgb2Zmc2V0LCA0LCAweDdmZmZmZmZmLCAtMHg4MDAwMDAwMClcbiAgaWYgKHZhbHVlIDwgMCkgdmFsdWUgPSAweGZmZmZmZmZmICsgdmFsdWUgKyAxXG4gIGlmIChCdWZmZXIuVFlQRURfQVJSQVlfU1VQUE9SVCkge1xuICAgIHRoaXNbb2Zmc2V0XSA9ICh2YWx1ZSA+Pj4gMjQpXG4gICAgdGhpc1tvZmZzZXQgKyAxXSA9ICh2YWx1ZSA+Pj4gMTYpXG4gICAgdGhpc1tvZmZzZXQgKyAyXSA9ICh2YWx1ZSA+Pj4gOClcbiAgICB0aGlzW29mZnNldCArIDNdID0gKHZhbHVlICYgMHhmZilcbiAgfSBlbHNlIHtcbiAgICBvYmplY3RXcml0ZVVJbnQzMih0aGlzLCB2YWx1ZSwgb2Zmc2V0LCBmYWxzZSlcbiAgfVxuICByZXR1cm4gb2Zmc2V0ICsgNFxufVxuXG5mdW5jdGlvbiBjaGVja0lFRUU3NTQgKGJ1ZiwgdmFsdWUsIG9mZnNldCwgZXh0LCBtYXgsIG1pbikge1xuICBpZiAob2Zmc2V0ICsgZXh0ID4gYnVmLmxlbmd0aCkgdGhyb3cgbmV3IFJhbmdlRXJyb3IoJ2luZGV4IG91dCBvZiByYW5nZScpXG4gIGlmIChvZmZzZXQgPCAwKSB0aHJvdyBuZXcgUmFuZ2VFcnJvcignaW5kZXggb3V0IG9mIHJhbmdlJylcbn1cblxuZnVuY3Rpb24gd3JpdGVGbG9hdCAoYnVmLCB2YWx1ZSwgb2Zmc2V0LCBsaXR0bGVFbmRpYW4sIG5vQXNzZXJ0KSB7XG4gIGlmICghbm9Bc3NlcnQpIHtcbiAgICBjaGVja0lFRUU3NTQoYnVmLCB2YWx1ZSwgb2Zmc2V0LCA0LCAzLjQwMjgyMzQ2NjM4NTI4ODZlKzM4LCAtMy40MDI4MjM0NjYzODUyODg2ZSszOClcbiAgfVxuICBpZWVlNzU0LndyaXRlKGJ1ZiwgdmFsdWUsIG9mZnNldCwgbGl0dGxlRW5kaWFuLCAyMywgNClcbiAgcmV0dXJuIG9mZnNldCArIDRcbn1cblxuQnVmZmVyLnByb3RvdHlwZS53cml0ZUZsb2F0TEUgPSBmdW5jdGlvbiB3cml0ZUZsb2F0TEUgKHZhbHVlLCBvZmZzZXQsIG5vQXNzZXJ0KSB7XG4gIHJldHVybiB3cml0ZUZsb2F0KHRoaXMsIHZhbHVlLCBvZmZzZXQsIHRydWUsIG5vQXNzZXJ0KVxufVxuXG5CdWZmZXIucHJvdG90eXBlLndyaXRlRmxvYXRCRSA9IGZ1bmN0aW9uIHdyaXRlRmxvYXRCRSAodmFsdWUsIG9mZnNldCwgbm9Bc3NlcnQpIHtcbiAgcmV0dXJuIHdyaXRlRmxvYXQodGhpcywgdmFsdWUsIG9mZnNldCwgZmFsc2UsIG5vQXNzZXJ0KVxufVxuXG5mdW5jdGlvbiB3cml0ZURvdWJsZSAoYnVmLCB2YWx1ZSwgb2Zmc2V0LCBsaXR0bGVFbmRpYW4sIG5vQXNzZXJ0KSB7XG4gIGlmICghbm9Bc3NlcnQpIHtcbiAgICBjaGVja0lFRUU3NTQoYnVmLCB2YWx1ZSwgb2Zmc2V0LCA4LCAxLjc5NzY5MzEzNDg2MjMxNTdFKzMwOCwgLTEuNzk3NjkzMTM0ODYyMzE1N0UrMzA4KVxuICB9XG4gIGllZWU3NTQud3JpdGUoYnVmLCB2YWx1ZSwgb2Zmc2V0LCBsaXR0bGVFbmRpYW4sIDUyLCA4KVxuICByZXR1cm4gb2Zmc2V0ICsgOFxufVxuXG5CdWZmZXIucHJvdG90eXBlLndyaXRlRG91YmxlTEUgPSBmdW5jdGlvbiB3cml0ZURvdWJsZUxFICh2YWx1ZSwgb2Zmc2V0LCBub0Fzc2VydCkge1xuICByZXR1cm4gd3JpdGVEb3VibGUodGhpcywgdmFsdWUsIG9mZnNldCwgdHJ1ZSwgbm9Bc3NlcnQpXG59XG5cbkJ1ZmZlci5wcm90b3R5cGUud3JpdGVEb3VibGVCRSA9IGZ1bmN0aW9uIHdyaXRlRG91YmxlQkUgKHZhbHVlLCBvZmZzZXQsIG5vQXNzZXJ0KSB7XG4gIHJldHVybiB3cml0ZURvdWJsZSh0aGlzLCB2YWx1ZSwgb2Zmc2V0LCBmYWxzZSwgbm9Bc3NlcnQpXG59XG5cbi8vIGNvcHkodGFyZ2V0QnVmZmVyLCB0YXJnZXRTdGFydD0wLCBzb3VyY2VTdGFydD0wLCBzb3VyY2VFbmQ9YnVmZmVyLmxlbmd0aClcbkJ1ZmZlci5wcm90b3R5cGUuY29weSA9IGZ1bmN0aW9uIGNvcHkgKHRhcmdldCwgdGFyZ2V0U3RhcnQsIHN0YXJ0LCBlbmQpIHtcbiAgaWYgKCFzdGFydCkgc3RhcnQgPSAwXG4gIGlmICghZW5kICYmIGVuZCAhPT0gMCkgZW5kID0gdGhpcy5sZW5ndGhcbiAgaWYgKHRhcmdldFN0YXJ0ID49IHRhcmdldC5sZW5ndGgpIHRhcmdldFN0YXJ0ID0gdGFyZ2V0Lmxlbmd0aFxuICBpZiAoIXRhcmdldFN0YXJ0KSB0YXJnZXRTdGFydCA9IDBcbiAgaWYgKGVuZCA+IDAgJiYgZW5kIDwgc3RhcnQpIGVuZCA9IHN0YXJ0XG5cbiAgLy8gQ29weSAwIGJ5dGVzOyB3ZSdyZSBkb25lXG4gIGlmIChlbmQgPT09IHN0YXJ0KSByZXR1cm4gMFxuICBpZiAodGFyZ2V0Lmxlbmd0aCA9PT0gMCB8fCB0aGlzLmxlbmd0aCA9PT0gMCkgcmV0dXJuIDBcblxuICAvLyBGYXRhbCBlcnJvciBjb25kaXRpb25zXG4gIGlmICh0YXJnZXRTdGFydCA8IDApIHtcbiAgICB0aHJvdyBuZXcgUmFuZ2VFcnJvcigndGFyZ2V0U3RhcnQgb3V0IG9mIGJvdW5kcycpXG4gIH1cbiAgaWYgKHN0YXJ0IDwgMCB8fCBzdGFydCA+PSB0aGlzLmxlbmd0aCkgdGhyb3cgbmV3IFJhbmdlRXJyb3IoJ3NvdXJjZVN0YXJ0IG91dCBvZiBib3VuZHMnKVxuICBpZiAoZW5kIDwgMCkgdGhyb3cgbmV3IFJhbmdlRXJyb3IoJ3NvdXJjZUVuZCBvdXQgb2YgYm91bmRzJylcblxuICAvLyBBcmUgd2Ugb29iP1xuICBpZiAoZW5kID4gdGhpcy5sZW5ndGgpIGVuZCA9IHRoaXMubGVuZ3RoXG4gIGlmICh0YXJnZXQubGVuZ3RoIC0gdGFyZ2V0U3RhcnQgPCBlbmQgLSBzdGFydCkge1xuICAgIGVuZCA9IHRhcmdldC5sZW5ndGggLSB0YXJnZXRTdGFydCArIHN0YXJ0XG4gIH1cblxuICB2YXIgbGVuID0gZW5kIC0gc3RhcnRcbiAgdmFyIGlcblxuICBpZiAodGhpcyA9PT0gdGFyZ2V0ICYmIHN0YXJ0IDwgdGFyZ2V0U3RhcnQgJiYgdGFyZ2V0U3RhcnQgPCBlbmQpIHtcbiAgICAvLyBkZXNjZW5kaW5nIGNvcHkgZnJvbSBlbmRcbiAgICBmb3IgKGkgPSBsZW4gLSAxOyBpID49IDA7IGktLSkge1xuICAgICAgdGFyZ2V0W2kgKyB0YXJnZXRTdGFydF0gPSB0aGlzW2kgKyBzdGFydF1cbiAgICB9XG4gIH0gZWxzZSBpZiAobGVuIDwgMTAwMCB8fCAhQnVmZmVyLlRZUEVEX0FSUkFZX1NVUFBPUlQpIHtcbiAgICAvLyBhc2NlbmRpbmcgY29weSBmcm9tIHN0YXJ0XG4gICAgZm9yIChpID0gMDsgaSA8IGxlbjsgaSsrKSB7XG4gICAgICB0YXJnZXRbaSArIHRhcmdldFN0YXJ0XSA9IHRoaXNbaSArIHN0YXJ0XVxuICAgIH1cbiAgfSBlbHNlIHtcbiAgICBVaW50OEFycmF5LnByb3RvdHlwZS5zZXQuY2FsbChcbiAgICAgIHRhcmdldCxcbiAgICAgIHRoaXMuc3ViYXJyYXkoc3RhcnQsIHN0YXJ0ICsgbGVuKSxcbiAgICAgIHRhcmdldFN0YXJ0XG4gICAgKVxuICB9XG5cbiAgcmV0dXJuIGxlblxufVxuXG4vLyBmaWxsKHZhbHVlLCBzdGFydD0wLCBlbmQ9YnVmZmVyLmxlbmd0aClcbkJ1ZmZlci5wcm90b3R5cGUuZmlsbCA9IGZ1bmN0aW9uIGZpbGwgKHZhbHVlLCBzdGFydCwgZW5kKSB7XG4gIGlmICghdmFsdWUpIHZhbHVlID0gMFxuICBpZiAoIXN0YXJ0KSBzdGFydCA9IDBcbiAgaWYgKCFlbmQpIGVuZCA9IHRoaXMubGVuZ3RoXG5cbiAgaWYgKGVuZCA8IHN0YXJ0KSB0aHJvdyBuZXcgUmFuZ2VFcnJvcignZW5kIDwgc3RhcnQnKVxuXG4gIC8vIEZpbGwgMCBieXRlczsgd2UncmUgZG9uZVxuICBpZiAoZW5kID09PSBzdGFydCkgcmV0dXJuXG4gIGlmICh0aGlzLmxlbmd0aCA9PT0gMCkgcmV0dXJuXG5cbiAgaWYgKHN0YXJ0IDwgMCB8fCBzdGFydCA+PSB0aGlzLmxlbmd0aCkgdGhyb3cgbmV3IFJhbmdlRXJyb3IoJ3N0YXJ0IG91dCBvZiBib3VuZHMnKVxuICBpZiAoZW5kIDwgMCB8fCBlbmQgPiB0aGlzLmxlbmd0aCkgdGhyb3cgbmV3IFJhbmdlRXJyb3IoJ2VuZCBvdXQgb2YgYm91bmRzJylcblxuICB2YXIgaVxuICBpZiAodHlwZW9mIHZhbHVlID09PSAnbnVtYmVyJykge1xuICAgIGZvciAoaSA9IHN0YXJ0OyBpIDwgZW5kOyBpKyspIHtcbiAgICAgIHRoaXNbaV0gPSB2YWx1ZVxuICAgIH1cbiAgfSBlbHNlIHtcbiAgICB2YXIgYnl0ZXMgPSB1dGY4VG9CeXRlcyh2YWx1ZS50b1N0cmluZygpKVxuICAgIHZhciBsZW4gPSBieXRlcy5sZW5ndGhcbiAgICBmb3IgKGkgPSBzdGFydDsgaSA8IGVuZDsgaSsrKSB7XG4gICAgICB0aGlzW2ldID0gYnl0ZXNbaSAlIGxlbl1cbiAgICB9XG4gIH1cblxuICByZXR1cm4gdGhpc1xufVxuXG4vLyBIRUxQRVIgRlVOQ1RJT05TXG4vLyA9PT09PT09PT09PT09PT09XG5cbnZhciBJTlZBTElEX0JBU0U2NF9SRSA9IC9bXitcXC8wLTlBLVphLXotX10vZ1xuXG5mdW5jdGlvbiBiYXNlNjRjbGVhbiAoc3RyKSB7XG4gIC8vIE5vZGUgc3RyaXBzIG91dCBpbnZhbGlkIGNoYXJhY3RlcnMgbGlrZSBcXG4gYW5kIFxcdCBmcm9tIHRoZSBzdHJpbmcsIGJhc2U2NC1qcyBkb2VzIG5vdFxuICBzdHIgPSBzdHJpbmd0cmltKHN0cikucmVwbGFjZShJTlZBTElEX0JBU0U2NF9SRSwgJycpXG4gIC8vIE5vZGUgY29udmVydHMgc3RyaW5ncyB3aXRoIGxlbmd0aCA8IDIgdG8gJydcbiAgaWYgKHN0ci5sZW5ndGggPCAyKSByZXR1cm4gJydcbiAgLy8gTm9kZSBhbGxvd3MgZm9yIG5vbi1wYWRkZWQgYmFzZTY0IHN0cmluZ3MgKG1pc3NpbmcgdHJhaWxpbmcgPT09KSwgYmFzZTY0LWpzIGRvZXMgbm90XG4gIHdoaWxlIChzdHIubGVuZ3RoICUgNCAhPT0gMCkge1xuICAgIHN0ciA9IHN0ciArICc9J1xuICB9XG4gIHJldHVybiBzdHJcbn1cblxuZnVuY3Rpb24gc3RyaW5ndHJpbSAoc3RyKSB7XG4gIGlmIChzdHIudHJpbSkgcmV0dXJuIHN0ci50cmltKClcbiAgcmV0dXJuIHN0ci5yZXBsYWNlKC9eXFxzK3xcXHMrJC9nLCAnJylcbn1cblxuZnVuY3Rpb24gdG9IZXggKG4pIHtcbiAgaWYgKG4gPCAxNikgcmV0dXJuICcwJyArIG4udG9TdHJpbmcoMTYpXG4gIHJldHVybiBuLnRvU3RyaW5nKDE2KVxufVxuXG5mdW5jdGlvbiB1dGY4VG9CeXRlcyAoc3RyaW5nLCB1bml0cykge1xuICB1bml0cyA9IHVuaXRzIHx8IEluZmluaXR5XG4gIHZhciBjb2RlUG9pbnRcbiAgdmFyIGxlbmd0aCA9IHN0cmluZy5sZW5ndGhcbiAgdmFyIGxlYWRTdXJyb2dhdGUgPSBudWxsXG4gIHZhciBieXRlcyA9IFtdXG5cbiAgZm9yICh2YXIgaSA9IDA7IGkgPCBsZW5ndGg7IGkrKykge1xuICAgIGNvZGVQb2ludCA9IHN0cmluZy5jaGFyQ29kZUF0KGkpXG5cbiAgICAvLyBpcyBzdXJyb2dhdGUgY29tcG9uZW50XG4gICAgaWYgKGNvZGVQb2ludCA+IDB4RDdGRiAmJiBjb2RlUG9pbnQgPCAweEUwMDApIHtcbiAgICAgIC8vIGxhc3QgY2hhciB3YXMgYSBsZWFkXG4gICAgICBpZiAoIWxlYWRTdXJyb2dhdGUpIHtcbiAgICAgICAgLy8gbm8gbGVhZCB5ZXRcbiAgICAgICAgaWYgKGNvZGVQb2ludCA+IDB4REJGRikge1xuICAgICAgICAgIC8vIHVuZXhwZWN0ZWQgdHJhaWxcbiAgICAgICAgICBpZiAoKHVuaXRzIC09IDMpID4gLTEpIGJ5dGVzLnB1c2goMHhFRiwgMHhCRiwgMHhCRClcbiAgICAgICAgICBjb250aW51ZVxuICAgICAgICB9IGVsc2UgaWYgKGkgKyAxID09PSBsZW5ndGgpIHtcbiAgICAgICAgICAvLyB1bnBhaXJlZCBsZWFkXG4gICAgICAgICAgaWYgKCh1bml0cyAtPSAzKSA+IC0xKSBieXRlcy5wdXNoKDB4RUYsIDB4QkYsIDB4QkQpXG4gICAgICAgICAgY29udGludWVcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIHZhbGlkIGxlYWRcbiAgICAgICAgbGVhZFN1cnJvZ2F0ZSA9IGNvZGVQb2ludFxuXG4gICAgICAgIGNvbnRpbnVlXG4gICAgICB9XG5cbiAgICAgIC8vIDIgbGVhZHMgaW4gYSByb3dcbiAgICAgIGlmIChjb2RlUG9pbnQgPCAweERDMDApIHtcbiAgICAgICAgaWYgKCh1bml0cyAtPSAzKSA+IC0xKSBieXRlcy5wdXNoKDB4RUYsIDB4QkYsIDB4QkQpXG4gICAgICAgIGxlYWRTdXJyb2dhdGUgPSBjb2RlUG9pbnRcbiAgICAgICAgY29udGludWVcbiAgICAgIH1cblxuICAgICAgLy8gdmFsaWQgc3Vycm9nYXRlIHBhaXJcbiAgICAgIGNvZGVQb2ludCA9IChsZWFkU3Vycm9nYXRlIC0gMHhEODAwIDw8IDEwIHwgY29kZVBvaW50IC0gMHhEQzAwKSArIDB4MTAwMDBcbiAgICB9IGVsc2UgaWYgKGxlYWRTdXJyb2dhdGUpIHtcbiAgICAgIC8vIHZhbGlkIGJtcCBjaGFyLCBidXQgbGFzdCBjaGFyIHdhcyBhIGxlYWRcbiAgICAgIGlmICgodW5pdHMgLT0gMykgPiAtMSkgYnl0ZXMucHVzaCgweEVGLCAweEJGLCAweEJEKVxuICAgIH1cblxuICAgIGxlYWRTdXJyb2dhdGUgPSBudWxsXG5cbiAgICAvLyBlbmNvZGUgdXRmOFxuICAgIGlmIChjb2RlUG9pbnQgPCAweDgwKSB7XG4gICAgICBpZiAoKHVuaXRzIC09IDEpIDwgMCkgYnJlYWtcbiAgICAgIGJ5dGVzLnB1c2goY29kZVBvaW50KVxuICAgIH0gZWxzZSBpZiAoY29kZVBvaW50IDwgMHg4MDApIHtcbiAgICAgIGlmICgodW5pdHMgLT0gMikgPCAwKSBicmVha1xuICAgICAgYnl0ZXMucHVzaChcbiAgICAgICAgY29kZVBvaW50ID4+IDB4NiB8IDB4QzAsXG4gICAgICAgIGNvZGVQb2ludCAmIDB4M0YgfCAweDgwXG4gICAgICApXG4gICAgfSBlbHNlIGlmIChjb2RlUG9pbnQgPCAweDEwMDAwKSB7XG4gICAgICBpZiAoKHVuaXRzIC09IDMpIDwgMCkgYnJlYWtcbiAgICAgIGJ5dGVzLnB1c2goXG4gICAgICAgIGNvZGVQb2ludCA+PiAweEMgfCAweEUwLFxuICAgICAgICBjb2RlUG9pbnQgPj4gMHg2ICYgMHgzRiB8IDB4ODAsXG4gICAgICAgIGNvZGVQb2ludCAmIDB4M0YgfCAweDgwXG4gICAgICApXG4gICAgfSBlbHNlIGlmIChjb2RlUG9pbnQgPCAweDExMDAwMCkge1xuICAgICAgaWYgKCh1bml0cyAtPSA0KSA8IDApIGJyZWFrXG4gICAgICBieXRlcy5wdXNoKFxuICAgICAgICBjb2RlUG9pbnQgPj4gMHgxMiB8IDB4RjAsXG4gICAgICAgIGNvZGVQb2ludCA+PiAweEMgJiAweDNGIHwgMHg4MCxcbiAgICAgICAgY29kZVBvaW50ID4+IDB4NiAmIDB4M0YgfCAweDgwLFxuICAgICAgICBjb2RlUG9pbnQgJiAweDNGIHwgMHg4MFxuICAgICAgKVxuICAgIH0gZWxzZSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoJ0ludmFsaWQgY29kZSBwb2ludCcpXG4gICAgfVxuICB9XG5cbiAgcmV0dXJuIGJ5dGVzXG59XG5cbmZ1bmN0aW9uIGFzY2lpVG9CeXRlcyAoc3RyKSB7XG4gIHZhciBieXRlQXJyYXkgPSBbXVxuICBmb3IgKHZhciBpID0gMDsgaSA8IHN0ci5sZW5ndGg7IGkrKykge1xuICAgIC8vIE5vZGUncyBjb2RlIHNlZW1zIHRvIGJlIGRvaW5nIHRoaXMgYW5kIG5vdCAmIDB4N0YuLlxuICAgIGJ5dGVBcnJheS5wdXNoKHN0ci5jaGFyQ29kZUF0KGkpICYgMHhGRilcbiAgfVxuICByZXR1cm4gYnl0ZUFycmF5XG59XG5cbmZ1bmN0aW9uIHV0ZjE2bGVUb0J5dGVzIChzdHIsIHVuaXRzKSB7XG4gIHZhciBjLCBoaSwgbG9cbiAgdmFyIGJ5dGVBcnJheSA9IFtdXG4gIGZvciAodmFyIGkgPSAwOyBpIDwgc3RyLmxlbmd0aDsgaSsrKSB7XG4gICAgaWYgKCh1bml0cyAtPSAyKSA8IDApIGJyZWFrXG5cbiAgICBjID0gc3RyLmNoYXJDb2RlQXQoaSlcbiAgICBoaSA9IGMgPj4gOFxuICAgIGxvID0gYyAlIDI1NlxuICAgIGJ5dGVBcnJheS5wdXNoKGxvKVxuICAgIGJ5dGVBcnJheS5wdXNoKGhpKVxuICB9XG5cbiAgcmV0dXJuIGJ5dGVBcnJheVxufVxuXG5mdW5jdGlvbiBiYXNlNjRUb0J5dGVzIChzdHIpIHtcbiAgcmV0dXJuIGJhc2U2NC50b0J5dGVBcnJheShiYXNlNjRjbGVhbihzdHIpKVxufVxuXG5mdW5jdGlvbiBibGl0QnVmZmVyIChzcmMsIGRzdCwgb2Zmc2V0LCBsZW5ndGgpIHtcbiAgZm9yICh2YXIgaSA9IDA7IGkgPCBsZW5ndGg7IGkrKykge1xuICAgIGlmICgoaSArIG9mZnNldCA+PSBkc3QubGVuZ3RoKSB8fCAoaSA+PSBzcmMubGVuZ3RoKSkgYnJlYWtcbiAgICBkc3RbaSArIG9mZnNldF0gPSBzcmNbaV1cbiAgfVxuICByZXR1cm4gaVxufVxuIiwiOyhmdW5jdGlvbiAoZXhwb3J0cykge1xuICAndXNlIHN0cmljdCdcblxuICB2YXIgbG9va3VwID0gJ0FCQ0RFRkdISUpLTE1OT1BRUlNUVVZXWFlaYWJjZGVmZ2hpamtsbW5vcHFyc3R1dnd4eXowMTIzNDU2Nzg5Ky8nXG5cbiAgdmFyIEFyciA9ICh0eXBlb2YgVWludDhBcnJheSAhPT0gJ3VuZGVmaW5lZCcpXG4gICAgPyBVaW50OEFycmF5XG4gICAgOiBBcnJheVxuXG4gIHZhciBQTFVTID0gJysnLmNoYXJDb2RlQXQoMClcbiAgdmFyIFNMQVNIID0gJy8nLmNoYXJDb2RlQXQoMClcbiAgdmFyIE5VTUJFUiA9ICcwJy5jaGFyQ29kZUF0KDApXG4gIHZhciBMT1dFUiA9ICdhJy5jaGFyQ29kZUF0KDApXG4gIHZhciBVUFBFUiA9ICdBJy5jaGFyQ29kZUF0KDApXG4gIHZhciBQTFVTX1VSTF9TQUZFID0gJy0nLmNoYXJDb2RlQXQoMClcbiAgdmFyIFNMQVNIX1VSTF9TQUZFID0gJ18nLmNoYXJDb2RlQXQoMClcblxuICBmdW5jdGlvbiBkZWNvZGUgKGVsdCkge1xuICAgIHZhciBjb2RlID0gZWx0LmNoYXJDb2RlQXQoMClcbiAgICBpZiAoY29kZSA9PT0gUExVUyB8fCBjb2RlID09PSBQTFVTX1VSTF9TQUZFKSByZXR1cm4gNjIgLy8gJysnXG4gICAgaWYgKGNvZGUgPT09IFNMQVNIIHx8IGNvZGUgPT09IFNMQVNIX1VSTF9TQUZFKSByZXR1cm4gNjMgLy8gJy8nXG4gICAgaWYgKGNvZGUgPCBOVU1CRVIpIHJldHVybiAtMSAvLyBubyBtYXRjaFxuICAgIGlmIChjb2RlIDwgTlVNQkVSICsgMTApIHJldHVybiBjb2RlIC0gTlVNQkVSICsgMjYgKyAyNlxuICAgIGlmIChjb2RlIDwgVVBQRVIgKyAyNikgcmV0dXJuIGNvZGUgLSBVUFBFUlxuICAgIGlmIChjb2RlIDwgTE9XRVIgKyAyNikgcmV0dXJuIGNvZGUgLSBMT1dFUiArIDI2XG4gIH1cblxuICBmdW5jdGlvbiBiNjRUb0J5dGVBcnJheSAoYjY0KSB7XG4gICAgdmFyIGksIGosIGwsIHRtcCwgcGxhY2VIb2xkZXJzLCBhcnJcblxuICAgIGlmIChiNjQubGVuZ3RoICUgNCA+IDApIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcignSW52YWxpZCBzdHJpbmcuIExlbmd0aCBtdXN0IGJlIGEgbXVsdGlwbGUgb2YgNCcpXG4gICAgfVxuXG4gICAgLy8gdGhlIG51bWJlciBvZiBlcXVhbCBzaWducyAocGxhY2UgaG9sZGVycylcbiAgICAvLyBpZiB0aGVyZSBhcmUgdHdvIHBsYWNlaG9sZGVycywgdGhhbiB0aGUgdHdvIGNoYXJhY3RlcnMgYmVmb3JlIGl0XG4gICAgLy8gcmVwcmVzZW50IG9uZSBieXRlXG4gICAgLy8gaWYgdGhlcmUgaXMgb25seSBvbmUsIHRoZW4gdGhlIHRocmVlIGNoYXJhY3RlcnMgYmVmb3JlIGl0IHJlcHJlc2VudCAyIGJ5dGVzXG4gICAgLy8gdGhpcyBpcyBqdXN0IGEgY2hlYXAgaGFjayB0byBub3QgZG8gaW5kZXhPZiB0d2ljZVxuICAgIHZhciBsZW4gPSBiNjQubGVuZ3RoXG4gICAgcGxhY2VIb2xkZXJzID0gYjY0LmNoYXJBdChsZW4gLSAyKSA9PT0gJz0nID8gMiA6IGI2NC5jaGFyQXQobGVuIC0gMSkgPT09ICc9JyA/IDEgOiAwXG5cbiAgICAvLyBiYXNlNjQgaXMgNC8zICsgdXAgdG8gdHdvIGNoYXJhY3RlcnMgb2YgdGhlIG9yaWdpbmFsIGRhdGFcbiAgICBhcnIgPSBuZXcgQXJyKGI2NC5sZW5ndGggKiAzIC8gNCAtIHBsYWNlSG9sZGVycylcblxuICAgIC8vIGlmIHRoZXJlIGFyZSBwbGFjZWhvbGRlcnMsIG9ubHkgZ2V0IHVwIHRvIHRoZSBsYXN0IGNvbXBsZXRlIDQgY2hhcnNcbiAgICBsID0gcGxhY2VIb2xkZXJzID4gMCA/IGI2NC5sZW5ndGggLSA0IDogYjY0Lmxlbmd0aFxuXG4gICAgdmFyIEwgPSAwXG5cbiAgICBmdW5jdGlvbiBwdXNoICh2KSB7XG4gICAgICBhcnJbTCsrXSA9IHZcbiAgICB9XG5cbiAgICBmb3IgKGkgPSAwLCBqID0gMDsgaSA8IGw7IGkgKz0gNCwgaiArPSAzKSB7XG4gICAgICB0bXAgPSAoZGVjb2RlKGI2NC5jaGFyQXQoaSkpIDw8IDE4KSB8IChkZWNvZGUoYjY0LmNoYXJBdChpICsgMSkpIDw8IDEyKSB8IChkZWNvZGUoYjY0LmNoYXJBdChpICsgMikpIDw8IDYpIHwgZGVjb2RlKGI2NC5jaGFyQXQoaSArIDMpKVxuICAgICAgcHVzaCgodG1wICYgMHhGRjAwMDApID4+IDE2KVxuICAgICAgcHVzaCgodG1wICYgMHhGRjAwKSA+PiA4KVxuICAgICAgcHVzaCh0bXAgJiAweEZGKVxuICAgIH1cblxuICAgIGlmIChwbGFjZUhvbGRlcnMgPT09IDIpIHtcbiAgICAgIHRtcCA9IChkZWNvZGUoYjY0LmNoYXJBdChpKSkgPDwgMikgfCAoZGVjb2RlKGI2NC5jaGFyQXQoaSArIDEpKSA+PiA0KVxuICAgICAgcHVzaCh0bXAgJiAweEZGKVxuICAgIH0gZWxzZSBpZiAocGxhY2VIb2xkZXJzID09PSAxKSB7XG4gICAgICB0bXAgPSAoZGVjb2RlKGI2NC5jaGFyQXQoaSkpIDw8IDEwKSB8IChkZWNvZGUoYjY0LmNoYXJBdChpICsgMSkpIDw8IDQpIHwgKGRlY29kZShiNjQuY2hhckF0KGkgKyAyKSkgPj4gMilcbiAgICAgIHB1c2goKHRtcCA+PiA4KSAmIDB4RkYpXG4gICAgICBwdXNoKHRtcCAmIDB4RkYpXG4gICAgfVxuXG4gICAgcmV0dXJuIGFyclxuICB9XG5cbiAgZnVuY3Rpb24gdWludDhUb0Jhc2U2NCAodWludDgpIHtcbiAgICB2YXIgaVxuICAgIHZhciBleHRyYUJ5dGVzID0gdWludDgubGVuZ3RoICUgMyAvLyBpZiB3ZSBoYXZlIDEgYnl0ZSBsZWZ0LCBwYWQgMiBieXRlc1xuICAgIHZhciBvdXRwdXQgPSAnJ1xuICAgIHZhciB0ZW1wLCBsZW5ndGhcblxuICAgIGZ1bmN0aW9uIGVuY29kZSAobnVtKSB7XG4gICAgICByZXR1cm4gbG9va3VwLmNoYXJBdChudW0pXG4gICAgfVxuXG4gICAgZnVuY3Rpb24gdHJpcGxldFRvQmFzZTY0IChudW0pIHtcbiAgICAgIHJldHVybiBlbmNvZGUobnVtID4+IDE4ICYgMHgzRikgKyBlbmNvZGUobnVtID4+IDEyICYgMHgzRikgKyBlbmNvZGUobnVtID4+IDYgJiAweDNGKSArIGVuY29kZShudW0gJiAweDNGKVxuICAgIH1cblxuICAgIC8vIGdvIHRocm91Z2ggdGhlIGFycmF5IGV2ZXJ5IHRocmVlIGJ5dGVzLCB3ZSdsbCBkZWFsIHdpdGggdHJhaWxpbmcgc3R1ZmYgbGF0ZXJcbiAgICBmb3IgKGkgPSAwLCBsZW5ndGggPSB1aW50OC5sZW5ndGggLSBleHRyYUJ5dGVzOyBpIDwgbGVuZ3RoOyBpICs9IDMpIHtcbiAgICAgIHRlbXAgPSAodWludDhbaV0gPDwgMTYpICsgKHVpbnQ4W2kgKyAxXSA8PCA4KSArICh1aW50OFtpICsgMl0pXG4gICAgICBvdXRwdXQgKz0gdHJpcGxldFRvQmFzZTY0KHRlbXApXG4gICAgfVxuXG4gICAgLy8gcGFkIHRoZSBlbmQgd2l0aCB6ZXJvcywgYnV0IG1ha2Ugc3VyZSB0byBub3QgZm9yZ2V0IHRoZSBleHRyYSBieXRlc1xuICAgIHN3aXRjaCAoZXh0cmFCeXRlcykge1xuICAgICAgY2FzZSAxOlxuICAgICAgICB0ZW1wID0gdWludDhbdWludDgubGVuZ3RoIC0gMV1cbiAgICAgICAgb3V0cHV0ICs9IGVuY29kZSh0ZW1wID4+IDIpXG4gICAgICAgIG91dHB1dCArPSBlbmNvZGUoKHRlbXAgPDwgNCkgJiAweDNGKVxuICAgICAgICBvdXRwdXQgKz0gJz09J1xuICAgICAgICBicmVha1xuICAgICAgY2FzZSAyOlxuICAgICAgICB0ZW1wID0gKHVpbnQ4W3VpbnQ4Lmxlbmd0aCAtIDJdIDw8IDgpICsgKHVpbnQ4W3VpbnQ4Lmxlbmd0aCAtIDFdKVxuICAgICAgICBvdXRwdXQgKz0gZW5jb2RlKHRlbXAgPj4gMTApXG4gICAgICAgIG91dHB1dCArPSBlbmNvZGUoKHRlbXAgPj4gNCkgJiAweDNGKVxuICAgICAgICBvdXRwdXQgKz0gZW5jb2RlKCh0ZW1wIDw8IDIpICYgMHgzRilcbiAgICAgICAgb3V0cHV0ICs9ICc9J1xuICAgICAgICBicmVha1xuICAgICAgZGVmYXVsdDpcbiAgICAgICAgYnJlYWtcbiAgICB9XG5cbiAgICByZXR1cm4gb3V0cHV0XG4gIH1cblxuICBleHBvcnRzLnRvQnl0ZUFycmF5ID0gYjY0VG9CeXRlQXJyYXlcbiAgZXhwb3J0cy5mcm9tQnl0ZUFycmF5ID0gdWludDhUb0Jhc2U2NFxufSh0eXBlb2YgZXhwb3J0cyA9PT0gJ3VuZGVmaW5lZCcgPyAodGhpcy5iYXNlNjRqcyA9IHt9KSA6IGV4cG9ydHMpKVxuIiwiZXhwb3J0cy5yZWFkID0gZnVuY3Rpb24gKGJ1ZmZlciwgb2Zmc2V0LCBpc0xFLCBtTGVuLCBuQnl0ZXMpIHtcbiAgdmFyIGUsIG1cbiAgdmFyIGVMZW4gPSBuQnl0ZXMgKiA4IC0gbUxlbiAtIDFcbiAgdmFyIGVNYXggPSAoMSA8PCBlTGVuKSAtIDFcbiAgdmFyIGVCaWFzID0gZU1heCA+PiAxXG4gIHZhciBuQml0cyA9IC03XG4gIHZhciBpID0gaXNMRSA/IChuQnl0ZXMgLSAxKSA6IDBcbiAgdmFyIGQgPSBpc0xFID8gLTEgOiAxXG4gIHZhciBzID0gYnVmZmVyW29mZnNldCArIGldXG5cbiAgaSArPSBkXG5cbiAgZSA9IHMgJiAoKDEgPDwgKC1uQml0cykpIC0gMSlcbiAgcyA+Pj0gKC1uQml0cylcbiAgbkJpdHMgKz0gZUxlblxuICBmb3IgKDsgbkJpdHMgPiAwOyBlID0gZSAqIDI1NiArIGJ1ZmZlcltvZmZzZXQgKyBpXSwgaSArPSBkLCBuQml0cyAtPSA4KSB7fVxuXG4gIG0gPSBlICYgKCgxIDw8ICgtbkJpdHMpKSAtIDEpXG4gIGUgPj49ICgtbkJpdHMpXG4gIG5CaXRzICs9IG1MZW5cbiAgZm9yICg7IG5CaXRzID4gMDsgbSA9IG0gKiAyNTYgKyBidWZmZXJbb2Zmc2V0ICsgaV0sIGkgKz0gZCwgbkJpdHMgLT0gOCkge31cblxuICBpZiAoZSA9PT0gMCkge1xuICAgIGUgPSAxIC0gZUJpYXNcbiAgfSBlbHNlIGlmIChlID09PSBlTWF4KSB7XG4gICAgcmV0dXJuIG0gPyBOYU4gOiAoKHMgPyAtMSA6IDEpICogSW5maW5pdHkpXG4gIH0gZWxzZSB7XG4gICAgbSA9IG0gKyBNYXRoLnBvdygyLCBtTGVuKVxuICAgIGUgPSBlIC0gZUJpYXNcbiAgfVxuICByZXR1cm4gKHMgPyAtMSA6IDEpICogbSAqIE1hdGgucG93KDIsIGUgLSBtTGVuKVxufVxuXG5leHBvcnRzLndyaXRlID0gZnVuY3Rpb24gKGJ1ZmZlciwgdmFsdWUsIG9mZnNldCwgaXNMRSwgbUxlbiwgbkJ5dGVzKSB7XG4gIHZhciBlLCBtLCBjXG4gIHZhciBlTGVuID0gbkJ5dGVzICogOCAtIG1MZW4gLSAxXG4gIHZhciBlTWF4ID0gKDEgPDwgZUxlbikgLSAxXG4gIHZhciBlQmlhcyA9IGVNYXggPj4gMVxuICB2YXIgcnQgPSAobUxlbiA9PT0gMjMgPyBNYXRoLnBvdygyLCAtMjQpIC0gTWF0aC5wb3coMiwgLTc3KSA6IDApXG4gIHZhciBpID0gaXNMRSA/IDAgOiAobkJ5dGVzIC0gMSlcbiAgdmFyIGQgPSBpc0xFID8gMSA6IC0xXG4gIHZhciBzID0gdmFsdWUgPCAwIHx8ICh2YWx1ZSA9PT0gMCAmJiAxIC8gdmFsdWUgPCAwKSA/IDEgOiAwXG5cbiAgdmFsdWUgPSBNYXRoLmFicyh2YWx1ZSlcblxuICBpZiAoaXNOYU4odmFsdWUpIHx8IHZhbHVlID09PSBJbmZpbml0eSkge1xuICAgIG0gPSBpc05hTih2YWx1ZSkgPyAxIDogMFxuICAgIGUgPSBlTWF4XG4gIH0gZWxzZSB7XG4gICAgZSA9IE1hdGguZmxvb3IoTWF0aC5sb2codmFsdWUpIC8gTWF0aC5MTjIpXG4gICAgaWYgKHZhbHVlICogKGMgPSBNYXRoLnBvdygyLCAtZSkpIDwgMSkge1xuICAgICAgZS0tXG4gICAgICBjICo9IDJcbiAgICB9XG4gICAgaWYgKGUgKyBlQmlhcyA+PSAxKSB7XG4gICAgICB2YWx1ZSArPSBydCAvIGNcbiAgICB9IGVsc2Uge1xuICAgICAgdmFsdWUgKz0gcnQgKiBNYXRoLnBvdygyLCAxIC0gZUJpYXMpXG4gICAgfVxuICAgIGlmICh2YWx1ZSAqIGMgPj0gMikge1xuICAgICAgZSsrXG4gICAgICBjIC89IDJcbiAgICB9XG5cbiAgICBpZiAoZSArIGVCaWFzID49IGVNYXgpIHtcbiAgICAgIG0gPSAwXG4gICAgICBlID0gZU1heFxuICAgIH0gZWxzZSBpZiAoZSArIGVCaWFzID49IDEpIHtcbiAgICAgIG0gPSAodmFsdWUgKiBjIC0gMSkgKiBNYXRoLnBvdygyLCBtTGVuKVxuICAgICAgZSA9IGUgKyBlQmlhc1xuICAgIH0gZWxzZSB7XG4gICAgICBtID0gdmFsdWUgKiBNYXRoLnBvdygyLCBlQmlhcyAtIDEpICogTWF0aC5wb3coMiwgbUxlbilcbiAgICAgIGUgPSAwXG4gICAgfVxuICB9XG5cbiAgZm9yICg7IG1MZW4gPj0gODsgYnVmZmVyW29mZnNldCArIGldID0gbSAmIDB4ZmYsIGkgKz0gZCwgbSAvPSAyNTYsIG1MZW4gLT0gOCkge31cblxuICBlID0gKGUgPDwgbUxlbikgfCBtXG4gIGVMZW4gKz0gbUxlblxuICBmb3IgKDsgZUxlbiA+IDA7IGJ1ZmZlcltvZmZzZXQgKyBpXSA9IGUgJiAweGZmLCBpICs9IGQsIGUgLz0gMjU2LCBlTGVuIC09IDgpIHt9XG5cbiAgYnVmZmVyW29mZnNldCArIGkgLSBkXSB8PSBzICogMTI4XG59XG4iLCJ2YXIgdG9TdHJpbmcgPSB7fS50b1N0cmluZztcblxubW9kdWxlLmV4cG9ydHMgPSBBcnJheS5pc0FycmF5IHx8IGZ1bmN0aW9uIChhcnIpIHtcbiAgcmV0dXJuIHRvU3RyaW5nLmNhbGwoYXJyKSA9PSAnW29iamVjdCBBcnJheV0nO1xufTtcbiIsIi8vIENvcHlyaWdodCBKb3llbnQsIEluYy4gYW5kIG90aGVyIE5vZGUgY29udHJpYnV0b3JzLlxuLy9cbi8vIFBlcm1pc3Npb24gaXMgaGVyZWJ5IGdyYW50ZWQsIGZyZWUgb2YgY2hhcmdlLCB0byBhbnkgcGVyc29uIG9idGFpbmluZyBhXG4vLyBjb3B5IG9mIHRoaXMgc29mdHdhcmUgYW5kIGFzc29jaWF0ZWQgZG9jdW1lbnRhdGlvbiBmaWxlcyAodGhlXG4vLyBcIlNvZnR3YXJlXCIpLCB0byBkZWFsIGluIHRoZSBTb2Z0d2FyZSB3aXRob3V0IHJlc3RyaWN0aW9uLCBpbmNsdWRpbmdcbi8vIHdpdGhvdXQgbGltaXRhdGlvbiB0aGUgcmlnaHRzIHRvIHVzZSwgY29weSwgbW9kaWZ5LCBtZXJnZSwgcHVibGlzaCxcbi8vIGRpc3RyaWJ1dGUsIHN1YmxpY2Vuc2UsIGFuZC9vciBzZWxsIGNvcGllcyBvZiB0aGUgU29mdHdhcmUsIGFuZCB0byBwZXJtaXRcbi8vIHBlcnNvbnMgdG8gd2hvbSB0aGUgU29mdHdhcmUgaXMgZnVybmlzaGVkIHRvIGRvIHNvLCBzdWJqZWN0IHRvIHRoZVxuLy8gZm9sbG93aW5nIGNvbmRpdGlvbnM6XG4vL1xuLy8gVGhlIGFib3ZlIGNvcHlyaWdodCBub3RpY2UgYW5kIHRoaXMgcGVybWlzc2lvbiBub3RpY2Ugc2hhbGwgYmUgaW5jbHVkZWRcbi8vIGluIGFsbCBjb3BpZXMgb3Igc3Vic3RhbnRpYWwgcG9ydGlvbnMgb2YgdGhlIFNvZnR3YXJlLlxuLy9cbi8vIFRIRSBTT0ZUV0FSRSBJUyBQUk9WSURFRCBcIkFTIElTXCIsIFdJVEhPVVQgV0FSUkFOVFkgT0YgQU5ZIEtJTkQsIEVYUFJFU1Ncbi8vIE9SIElNUExJRUQsIElOQ0xVRElORyBCVVQgTk9UIExJTUlURUQgVE8gVEhFIFdBUlJBTlRJRVMgT0Zcbi8vIE1FUkNIQU5UQUJJTElUWSwgRklUTkVTUyBGT1IgQSBQQVJUSUNVTEFSIFBVUlBPU0UgQU5EIE5PTklORlJJTkdFTUVOVC4gSU5cbi8vIE5PIEVWRU5UIFNIQUxMIFRIRSBBVVRIT1JTIE9SIENPUFlSSUdIVCBIT0xERVJTIEJFIExJQUJMRSBGT1IgQU5ZIENMQUlNLFxuLy8gREFNQUdFUyBPUiBPVEhFUiBMSUFCSUxJVFksIFdIRVRIRVIgSU4gQU4gQUNUSU9OIE9GIENPTlRSQUNULCBUT1JUIE9SXG4vLyBPVEhFUldJU0UsIEFSSVNJTkcgRlJPTSwgT1VUIE9GIE9SIElOIENPTk5FQ1RJT04gV0lUSCBUSEUgU09GVFdBUkUgT1IgVEhFXG4vLyBVU0UgT1IgT1RIRVIgREVBTElOR1MgSU4gVEhFIFNPRlRXQVJFLlxuXG5mdW5jdGlvbiBFdmVudEVtaXR0ZXIoKSB7XG4gIHRoaXMuX2V2ZW50cyA9IHRoaXMuX2V2ZW50cyB8fCB7fTtcbiAgdGhpcy5fbWF4TGlzdGVuZXJzID0gdGhpcy5fbWF4TGlzdGVuZXJzIHx8IHVuZGVmaW5lZDtcbn1cbm1vZHVsZS5leHBvcnRzID0gRXZlbnRFbWl0dGVyO1xuXG4vLyBCYWNrd2FyZHMtY29tcGF0IHdpdGggbm9kZSAwLjEwLnhcbkV2ZW50RW1pdHRlci5FdmVudEVtaXR0ZXIgPSBFdmVudEVtaXR0ZXI7XG5cbkV2ZW50RW1pdHRlci5wcm90b3R5cGUuX2V2ZW50cyA9IHVuZGVmaW5lZDtcbkV2ZW50RW1pdHRlci5wcm90b3R5cGUuX21heExpc3RlbmVycyA9IHVuZGVmaW5lZDtcblxuLy8gQnkgZGVmYXVsdCBFdmVudEVtaXR0ZXJzIHdpbGwgcHJpbnQgYSB3YXJuaW5nIGlmIG1vcmUgdGhhbiAxMCBsaXN0ZW5lcnMgYXJlXG4vLyBhZGRlZCB0byBpdC4gVGhpcyBpcyBhIHVzZWZ1bCBkZWZhdWx0IHdoaWNoIGhlbHBzIGZpbmRpbmcgbWVtb3J5IGxlYWtzLlxuRXZlbnRFbWl0dGVyLmRlZmF1bHRNYXhMaXN0ZW5lcnMgPSAxMDtcblxuLy8gT2J2aW91c2x5IG5vdCBhbGwgRW1pdHRlcnMgc2hvdWxkIGJlIGxpbWl0ZWQgdG8gMTAuIFRoaXMgZnVuY3Rpb24gYWxsb3dzXG4vLyB0aGF0IHRvIGJlIGluY3JlYXNlZC4gU2V0IHRvIHplcm8gZm9yIHVubGltaXRlZC5cbkV2ZW50RW1pdHRlci5wcm90b3R5cGUuc2V0TWF4TGlzdGVuZXJzID0gZnVuY3Rpb24obikge1xuICBpZiAoIWlzTnVtYmVyKG4pIHx8IG4gPCAwIHx8IGlzTmFOKG4pKVxuICAgIHRocm93IFR5cGVFcnJvcignbiBtdXN0IGJlIGEgcG9zaXRpdmUgbnVtYmVyJyk7XG4gIHRoaXMuX21heExpc3RlbmVycyA9IG47XG4gIHJldHVybiB0aGlzO1xufTtcblxuRXZlbnRFbWl0dGVyLnByb3RvdHlwZS5lbWl0ID0gZnVuY3Rpb24odHlwZSkge1xuICB2YXIgZXIsIGhhbmRsZXIsIGxlbiwgYXJncywgaSwgbGlzdGVuZXJzO1xuXG4gIGlmICghdGhpcy5fZXZlbnRzKVxuICAgIHRoaXMuX2V2ZW50cyA9IHt9O1xuXG4gIC8vIElmIHRoZXJlIGlzIG5vICdlcnJvcicgZXZlbnQgbGlzdGVuZXIgdGhlbiB0aHJvdy5cbiAgaWYgKHR5cGUgPT09ICdlcnJvcicpIHtcbiAgICBpZiAoIXRoaXMuX2V2ZW50cy5lcnJvciB8fFxuICAgICAgICAoaXNPYmplY3QodGhpcy5fZXZlbnRzLmVycm9yKSAmJiAhdGhpcy5fZXZlbnRzLmVycm9yLmxlbmd0aCkpIHtcbiAgICAgIGVyID0gYXJndW1lbnRzWzFdO1xuICAgICAgaWYgKGVyIGluc3RhbmNlb2YgRXJyb3IpIHtcbiAgICAgICAgdGhyb3cgZXI7IC8vIFVuaGFuZGxlZCAnZXJyb3InIGV2ZW50XG4gICAgICB9XG4gICAgICB0aHJvdyBUeXBlRXJyb3IoJ1VuY2F1Z2h0LCB1bnNwZWNpZmllZCBcImVycm9yXCIgZXZlbnQuJyk7XG4gICAgfVxuICB9XG5cbiAgaGFuZGxlciA9IHRoaXMuX2V2ZW50c1t0eXBlXTtcblxuICBpZiAoaXNVbmRlZmluZWQoaGFuZGxlcikpXG4gICAgcmV0dXJuIGZhbHNlO1xuXG4gIGlmIChpc0Z1bmN0aW9uKGhhbmRsZXIpKSB7XG4gICAgc3dpdGNoIChhcmd1bWVudHMubGVuZ3RoKSB7XG4gICAgICAvLyBmYXN0IGNhc2VzXG4gICAgICBjYXNlIDE6XG4gICAgICAgIGhhbmRsZXIuY2FsbCh0aGlzKTtcbiAgICAgICAgYnJlYWs7XG4gICAgICBjYXNlIDI6XG4gICAgICAgIGhhbmRsZXIuY2FsbCh0aGlzLCBhcmd1bWVudHNbMV0pO1xuICAgICAgICBicmVhaztcbiAgICAgIGNhc2UgMzpcbiAgICAgICAgaGFuZGxlci5jYWxsKHRoaXMsIGFyZ3VtZW50c1sxXSwgYXJndW1lbnRzWzJdKTtcbiAgICAgICAgYnJlYWs7XG4gICAgICAvLyBzbG93ZXJcbiAgICAgIGRlZmF1bHQ6XG4gICAgICAgIGFyZ3MgPSBBcnJheS5wcm90b3R5cGUuc2xpY2UuY2FsbChhcmd1bWVudHMsIDEpO1xuICAgICAgICBoYW5kbGVyLmFwcGx5KHRoaXMsIGFyZ3MpO1xuICAgIH1cbiAgfSBlbHNlIGlmIChpc09iamVjdChoYW5kbGVyKSkge1xuICAgIGFyZ3MgPSBBcnJheS5wcm90b3R5cGUuc2xpY2UuY2FsbChhcmd1bWVudHMsIDEpO1xuICAgIGxpc3RlbmVycyA9IGhhbmRsZXIuc2xpY2UoKTtcbiAgICBsZW4gPSBsaXN0ZW5lcnMubGVuZ3RoO1xuICAgIGZvciAoaSA9IDA7IGkgPCBsZW47IGkrKylcbiAgICAgIGxpc3RlbmVyc1tpXS5hcHBseSh0aGlzLCBhcmdzKTtcbiAgfVxuXG4gIHJldHVybiB0cnVlO1xufTtcblxuRXZlbnRFbWl0dGVyLnByb3RvdHlwZS5hZGRMaXN0ZW5lciA9IGZ1bmN0aW9uKHR5cGUsIGxpc3RlbmVyKSB7XG4gIHZhciBtO1xuXG4gIGlmICghaXNGdW5jdGlvbihsaXN0ZW5lcikpXG4gICAgdGhyb3cgVHlwZUVycm9yKCdsaXN0ZW5lciBtdXN0IGJlIGEgZnVuY3Rpb24nKTtcblxuICBpZiAoIXRoaXMuX2V2ZW50cylcbiAgICB0aGlzLl9ldmVudHMgPSB7fTtcblxuICAvLyBUbyBhdm9pZCByZWN1cnNpb24gaW4gdGhlIGNhc2UgdGhhdCB0eXBlID09PSBcIm5ld0xpc3RlbmVyXCIhIEJlZm9yZVxuICAvLyBhZGRpbmcgaXQgdG8gdGhlIGxpc3RlbmVycywgZmlyc3QgZW1pdCBcIm5ld0xpc3RlbmVyXCIuXG4gIGlmICh0aGlzLl9ldmVudHMubmV3TGlzdGVuZXIpXG4gICAgdGhpcy5lbWl0KCduZXdMaXN0ZW5lcicsIHR5cGUsXG4gICAgICAgICAgICAgIGlzRnVuY3Rpb24obGlzdGVuZXIubGlzdGVuZXIpID9cbiAgICAgICAgICAgICAgbGlzdGVuZXIubGlzdGVuZXIgOiBsaXN0ZW5lcik7XG5cbiAgaWYgKCF0aGlzLl9ldmVudHNbdHlwZV0pXG4gICAgLy8gT3B0aW1pemUgdGhlIGNhc2Ugb2Ygb25lIGxpc3RlbmVyLiBEb24ndCBuZWVkIHRoZSBleHRyYSBhcnJheSBvYmplY3QuXG4gICAgdGhpcy5fZXZlbnRzW3R5cGVdID0gbGlzdGVuZXI7XG4gIGVsc2UgaWYgKGlzT2JqZWN0KHRoaXMuX2V2ZW50c1t0eXBlXSkpXG4gICAgLy8gSWYgd2UndmUgYWxyZWFkeSBnb3QgYW4gYXJyYXksIGp1c3QgYXBwZW5kLlxuICAgIHRoaXMuX2V2ZW50c1t0eXBlXS5wdXNoKGxpc3RlbmVyKTtcbiAgZWxzZVxuICAgIC8vIEFkZGluZyB0aGUgc2Vjb25kIGVsZW1lbnQsIG5lZWQgdG8gY2hhbmdlIHRvIGFycmF5LlxuICAgIHRoaXMuX2V2ZW50c1t0eXBlXSA9IFt0aGlzLl9ldmVudHNbdHlwZV0sIGxpc3RlbmVyXTtcblxuICAvLyBDaGVjayBmb3IgbGlzdGVuZXIgbGVha1xuICBpZiAoaXNPYmplY3QodGhpcy5fZXZlbnRzW3R5cGVdKSAmJiAhdGhpcy5fZXZlbnRzW3R5cGVdLndhcm5lZCkge1xuICAgIGlmICghaXNVbmRlZmluZWQodGhpcy5fbWF4TGlzdGVuZXJzKSkge1xuICAgICAgbSA9IHRoaXMuX21heExpc3RlbmVycztcbiAgICB9IGVsc2Uge1xuICAgICAgbSA9IEV2ZW50RW1pdHRlci5kZWZhdWx0TWF4TGlzdGVuZXJzO1xuICAgIH1cblxuICAgIGlmIChtICYmIG0gPiAwICYmIHRoaXMuX2V2ZW50c1t0eXBlXS5sZW5ndGggPiBtKSB7XG4gICAgICB0aGlzLl9ldmVudHNbdHlwZV0ud2FybmVkID0gdHJ1ZTtcbiAgICAgIGNvbnNvbGUuZXJyb3IoJyhub2RlKSB3YXJuaW5nOiBwb3NzaWJsZSBFdmVudEVtaXR0ZXIgbWVtb3J5ICcgK1xuICAgICAgICAgICAgICAgICAgICAnbGVhayBkZXRlY3RlZC4gJWQgbGlzdGVuZXJzIGFkZGVkLiAnICtcbiAgICAgICAgICAgICAgICAgICAgJ1VzZSBlbWl0dGVyLnNldE1heExpc3RlbmVycygpIHRvIGluY3JlYXNlIGxpbWl0LicsXG4gICAgICAgICAgICAgICAgICAgIHRoaXMuX2V2ZW50c1t0eXBlXS5sZW5ndGgpO1xuICAgICAgaWYgKHR5cGVvZiBjb25zb2xlLnRyYWNlID09PSAnZnVuY3Rpb24nKSB7XG4gICAgICAgIC8vIG5vdCBzdXBwb3J0ZWQgaW4gSUUgMTBcbiAgICAgICAgY29uc29sZS50cmFjZSgpO1xuICAgICAgfVxuICAgIH1cbiAgfVxuXG4gIHJldHVybiB0aGlzO1xufTtcblxuRXZlbnRFbWl0dGVyLnByb3RvdHlwZS5vbiA9IEV2ZW50RW1pdHRlci5wcm90b3R5cGUuYWRkTGlzdGVuZXI7XG5cbkV2ZW50RW1pdHRlci5wcm90b3R5cGUub25jZSA9IGZ1bmN0aW9uKHR5cGUsIGxpc3RlbmVyKSB7XG4gIGlmICghaXNGdW5jdGlvbihsaXN0ZW5lcikpXG4gICAgdGhyb3cgVHlwZUVycm9yKCdsaXN0ZW5lciBtdXN0IGJlIGEgZnVuY3Rpb24nKTtcblxuICB2YXIgZmlyZWQgPSBmYWxzZTtcblxuICBmdW5jdGlvbiBnKCkge1xuICAgIHRoaXMucmVtb3ZlTGlzdGVuZXIodHlwZSwgZyk7XG5cbiAgICBpZiAoIWZpcmVkKSB7XG4gICAgICBmaXJlZCA9IHRydWU7XG4gICAgICBsaXN0ZW5lci5hcHBseSh0aGlzLCBhcmd1bWVudHMpO1xuICAgIH1cbiAgfVxuXG4gIGcubGlzdGVuZXIgPSBsaXN0ZW5lcjtcbiAgdGhpcy5vbih0eXBlLCBnKTtcblxuICByZXR1cm4gdGhpcztcbn07XG5cbi8vIGVtaXRzIGEgJ3JlbW92ZUxpc3RlbmVyJyBldmVudCBpZmYgdGhlIGxpc3RlbmVyIHdhcyByZW1vdmVkXG5FdmVudEVtaXR0ZXIucHJvdG90eXBlLnJlbW92ZUxpc3RlbmVyID0gZnVuY3Rpb24odHlwZSwgbGlzdGVuZXIpIHtcbiAgdmFyIGxpc3QsIHBvc2l0aW9uLCBsZW5ndGgsIGk7XG5cbiAgaWYgKCFpc0Z1bmN0aW9uKGxpc3RlbmVyKSlcbiAgICB0aHJvdyBUeXBlRXJyb3IoJ2xpc3RlbmVyIG11c3QgYmUgYSBmdW5jdGlvbicpO1xuXG4gIGlmICghdGhpcy5fZXZlbnRzIHx8ICF0aGlzLl9ldmVudHNbdHlwZV0pXG4gICAgcmV0dXJuIHRoaXM7XG5cbiAgbGlzdCA9IHRoaXMuX2V2ZW50c1t0eXBlXTtcbiAgbGVuZ3RoID0gbGlzdC5sZW5ndGg7XG4gIHBvc2l0aW9uID0gLTE7XG5cbiAgaWYgKGxpc3QgPT09IGxpc3RlbmVyIHx8XG4gICAgICAoaXNGdW5jdGlvbihsaXN0Lmxpc3RlbmVyKSAmJiBsaXN0Lmxpc3RlbmVyID09PSBsaXN0ZW5lcikpIHtcbiAgICBkZWxldGUgdGhpcy5fZXZlbnRzW3R5cGVdO1xuICAgIGlmICh0aGlzLl9ldmVudHMucmVtb3ZlTGlzdGVuZXIpXG4gICAgICB0aGlzLmVtaXQoJ3JlbW92ZUxpc3RlbmVyJywgdHlwZSwgbGlzdGVuZXIpO1xuXG4gIH0gZWxzZSBpZiAoaXNPYmplY3QobGlzdCkpIHtcbiAgICBmb3IgKGkgPSBsZW5ndGg7IGktLSA+IDA7KSB7XG4gICAgICBpZiAobGlzdFtpXSA9PT0gbGlzdGVuZXIgfHxcbiAgICAgICAgICAobGlzdFtpXS5saXN0ZW5lciAmJiBsaXN0W2ldLmxpc3RlbmVyID09PSBsaXN0ZW5lcikpIHtcbiAgICAgICAgcG9zaXRpb24gPSBpO1xuICAgICAgICBicmVhaztcbiAgICAgIH1cbiAgICB9XG5cbiAgICBpZiAocG9zaXRpb24gPCAwKVxuICAgICAgcmV0dXJuIHRoaXM7XG5cbiAgICBpZiAobGlzdC5sZW5ndGggPT09IDEpIHtcbiAgICAgIGxpc3QubGVuZ3RoID0gMDtcbiAgICAgIGRlbGV0ZSB0aGlzLl9ldmVudHNbdHlwZV07XG4gICAgfSBlbHNlIHtcbiAgICAgIGxpc3Quc3BsaWNlKHBvc2l0aW9uLCAxKTtcbiAgICB9XG5cbiAgICBpZiAodGhpcy5fZXZlbnRzLnJlbW92ZUxpc3RlbmVyKVxuICAgICAgdGhpcy5lbWl0KCdyZW1vdmVMaXN0ZW5lcicsIHR5cGUsIGxpc3RlbmVyKTtcbiAgfVxuXG4gIHJldHVybiB0aGlzO1xufTtcblxuRXZlbnRFbWl0dGVyLnByb3RvdHlwZS5yZW1vdmVBbGxMaXN0ZW5lcnMgPSBmdW5jdGlvbih0eXBlKSB7XG4gIHZhciBrZXksIGxpc3RlbmVycztcblxuICBpZiAoIXRoaXMuX2V2ZW50cylcbiAgICByZXR1cm4gdGhpcztcblxuICAvLyBub3QgbGlzdGVuaW5nIGZvciByZW1vdmVMaXN0ZW5lciwgbm8gbmVlZCB0byBlbWl0XG4gIGlmICghdGhpcy5fZXZlbnRzLnJlbW92ZUxpc3RlbmVyKSB7XG4gICAgaWYgKGFyZ3VtZW50cy5sZW5ndGggPT09IDApXG4gICAgICB0aGlzLl9ldmVudHMgPSB7fTtcbiAgICBlbHNlIGlmICh0aGlzLl9ldmVudHNbdHlwZV0pXG4gICAgICBkZWxldGUgdGhpcy5fZXZlbnRzW3R5cGVdO1xuICAgIHJldHVybiB0aGlzO1xuICB9XG5cbiAgLy8gZW1pdCByZW1vdmVMaXN0ZW5lciBmb3IgYWxsIGxpc3RlbmVycyBvbiBhbGwgZXZlbnRzXG4gIGlmIChhcmd1bWVudHMubGVuZ3RoID09PSAwKSB7XG4gICAgZm9yIChrZXkgaW4gdGhpcy5fZXZlbnRzKSB7XG4gICAgICBpZiAoa2V5ID09PSAncmVtb3ZlTGlzdGVuZXInKSBjb250aW51ZTtcbiAgICAgIHRoaXMucmVtb3ZlQWxsTGlzdGVuZXJzKGtleSk7XG4gICAgfVxuICAgIHRoaXMucmVtb3ZlQWxsTGlzdGVuZXJzKCdyZW1vdmVMaXN0ZW5lcicpO1xuICAgIHRoaXMuX2V2ZW50cyA9IHt9O1xuICAgIHJldHVybiB0aGlzO1xuICB9XG5cbiAgbGlzdGVuZXJzID0gdGhpcy5fZXZlbnRzW3R5cGVdO1xuXG4gIGlmIChpc0Z1bmN0aW9uKGxpc3RlbmVycykpIHtcbiAgICB0aGlzLnJlbW92ZUxpc3RlbmVyKHR5cGUsIGxpc3RlbmVycyk7XG4gIH0gZWxzZSBpZiAobGlzdGVuZXJzKSB7XG4gICAgLy8gTElGTyBvcmRlclxuICAgIHdoaWxlIChsaXN0ZW5lcnMubGVuZ3RoKVxuICAgICAgdGhpcy5yZW1vdmVMaXN0ZW5lcih0eXBlLCBsaXN0ZW5lcnNbbGlzdGVuZXJzLmxlbmd0aCAtIDFdKTtcbiAgfVxuICBkZWxldGUgdGhpcy5fZXZlbnRzW3R5cGVdO1xuXG4gIHJldHVybiB0aGlzO1xufTtcblxuRXZlbnRFbWl0dGVyLnByb3RvdHlwZS5saXN0ZW5lcnMgPSBmdW5jdGlvbih0eXBlKSB7XG4gIHZhciByZXQ7XG4gIGlmICghdGhpcy5fZXZlbnRzIHx8ICF0aGlzLl9ldmVudHNbdHlwZV0pXG4gICAgcmV0ID0gW107XG4gIGVsc2UgaWYgKGlzRnVuY3Rpb24odGhpcy5fZXZlbnRzW3R5cGVdKSlcbiAgICByZXQgPSBbdGhpcy5fZXZlbnRzW3R5cGVdXTtcbiAgZWxzZVxuICAgIHJldCA9IHRoaXMuX2V2ZW50c1t0eXBlXS5zbGljZSgpO1xuICByZXR1cm4gcmV0O1xufTtcblxuRXZlbnRFbWl0dGVyLnByb3RvdHlwZS5saXN0ZW5lckNvdW50ID0gZnVuY3Rpb24odHlwZSkge1xuICBpZiAodGhpcy5fZXZlbnRzKSB7XG4gICAgdmFyIGV2bGlzdGVuZXIgPSB0aGlzLl9ldmVudHNbdHlwZV07XG5cbiAgICBpZiAoaXNGdW5jdGlvbihldmxpc3RlbmVyKSlcbiAgICAgIHJldHVybiAxO1xuICAgIGVsc2UgaWYgKGV2bGlzdGVuZXIpXG4gICAgICByZXR1cm4gZXZsaXN0ZW5lci5sZW5ndGg7XG4gIH1cbiAgcmV0dXJuIDA7XG59O1xuXG5FdmVudEVtaXR0ZXIubGlzdGVuZXJDb3VudCA9IGZ1bmN0aW9uKGVtaXR0ZXIsIHR5cGUpIHtcbiAgcmV0dXJuIGVtaXR0ZXIubGlzdGVuZXJDb3VudCh0eXBlKTtcbn07XG5cbmZ1bmN0aW9uIGlzRnVuY3Rpb24oYXJnKSB7XG4gIHJldHVybiB0eXBlb2YgYXJnID09PSAnZnVuY3Rpb24nO1xufVxuXG5mdW5jdGlvbiBpc051bWJlcihhcmcpIHtcbiAgcmV0dXJuIHR5cGVvZiBhcmcgPT09ICdudW1iZXInO1xufVxuXG5mdW5jdGlvbiBpc09iamVjdChhcmcpIHtcbiAgcmV0dXJuIHR5cGVvZiBhcmcgPT09ICdvYmplY3QnICYmIGFyZyAhPT0gbnVsbDtcbn1cblxuZnVuY3Rpb24gaXNVbmRlZmluZWQoYXJnKSB7XG4gIHJldHVybiBhcmcgPT09IHZvaWQgMDtcbn1cbiIsIi8qKlxuICogRGV0ZXJtaW5lIGlmIGFuIG9iamVjdCBpcyBCdWZmZXJcbiAqXG4gKiBBdXRob3I6ICAgRmVyb3NzIEFib3VraGFkaWplaCA8ZmVyb3NzQGZlcm9zcy5vcmc+IDxodHRwOi8vZmVyb3NzLm9yZz5cbiAqIExpY2Vuc2U6ICBNSVRcbiAqXG4gKiBgbnBtIGluc3RhbGwgaXMtYnVmZmVyYFxuICovXG5cbm1vZHVsZS5leHBvcnRzID0gZnVuY3Rpb24gKG9iaikge1xuICByZXR1cm4gISEob2JqICE9IG51bGwgJiZcbiAgICAob2JqLl9pc0J1ZmZlciB8fCAvLyBGb3IgU2FmYXJpIDUtNyAobWlzc2luZyBPYmplY3QucHJvdG90eXBlLmNvbnN0cnVjdG9yKVxuICAgICAgKG9iai5jb25zdHJ1Y3RvciAmJlxuICAgICAgdHlwZW9mIG9iai5jb25zdHJ1Y3Rvci5pc0J1ZmZlciA9PT0gJ2Z1bmN0aW9uJyAmJlxuICAgICAgb2JqLmNvbnN0cnVjdG9yLmlzQnVmZmVyKG9iaikpXG4gICAgKSlcbn1cbiIsIm1vZHVsZS5leHBvcnRzID0gQXJyYXkuaXNBcnJheSB8fCBmdW5jdGlvbiAoYXJyKSB7XG4gIHJldHVybiBPYmplY3QucHJvdG90eXBlLnRvU3RyaW5nLmNhbGwoYXJyKSA9PSAnW29iamVjdCBBcnJheV0nO1xufTtcbiIsIi8vIENvcHlyaWdodCBKb3llbnQsIEluYy4gYW5kIG90aGVyIE5vZGUgY29udHJpYnV0b3JzLlxuLy9cbi8vIFBlcm1pc3Npb24gaXMgaGVyZWJ5IGdyYW50ZWQsIGZyZWUgb2YgY2hhcmdlLCB0byBhbnkgcGVyc29uIG9idGFpbmluZyBhXG4vLyBjb3B5IG9mIHRoaXMgc29mdHdhcmUgYW5kIGFzc29jaWF0ZWQgZG9jdW1lbnRhdGlvbiBmaWxlcyAodGhlXG4vLyBcIlNvZnR3YXJlXCIpLCB0byBkZWFsIGluIHRoZSBTb2Z0d2FyZSB3aXRob3V0IHJlc3RyaWN0aW9uLCBpbmNsdWRpbmdcbi8vIHdpdGhvdXQgbGltaXRhdGlvbiB0aGUgcmlnaHRzIHRvIHVzZSwgY29weSwgbW9kaWZ5LCBtZXJnZSwgcHVibGlzaCxcbi8vIGRpc3RyaWJ1dGUsIHN1YmxpY2Vuc2UsIGFuZC9vciBzZWxsIGNvcGllcyBvZiB0aGUgU29mdHdhcmUsIGFuZCB0byBwZXJtaXRcbi8vIHBlcnNvbnMgdG8gd2hvbSB0aGUgU29mdHdhcmUgaXMgZnVybmlzaGVkIHRvIGRvIHNvLCBzdWJqZWN0IHRvIHRoZVxuLy8gZm9sbG93aW5nIGNvbmRpdGlvbnM6XG4vL1xuLy8gVGhlIGFib3ZlIGNvcHlyaWdodCBub3RpY2UgYW5kIHRoaXMgcGVybWlzc2lvbiBub3RpY2Ugc2hhbGwgYmUgaW5jbHVkZWRcbi8vIGluIGFsbCBjb3BpZXMgb3Igc3Vic3RhbnRpYWwgcG9ydGlvbnMgb2YgdGhlIFNvZnR3YXJlLlxuLy9cbi8vIFRIRSBTT0ZUV0FSRSBJUyBQUk9WSURFRCBcIkFTIElTXCIsIFdJVEhPVVQgV0FSUkFOVFkgT0YgQU5ZIEtJTkQsIEVYUFJFU1Ncbi8vIE9SIElNUExJRUQsIElOQ0xVRElORyBCVVQgTk9UIExJTUlURUQgVE8gVEhFIFdBUlJBTlRJRVMgT0Zcbi8vIE1FUkNIQU5UQUJJTElUWSwgRklUTkVTUyBGT1IgQSBQQVJUSUNVTEFSIFBVUlBPU0UgQU5EIE5PTklORlJJTkdFTUVOVC4gSU5cbi8vIE5PIEVWRU5UIFNIQUxMIFRIRSBBVVRIT1JTIE9SIENPUFlSSUdIVCBIT0xERVJTIEJFIExJQUJMRSBGT1IgQU5ZIENMQUlNLFxuLy8gREFNQUdFUyBPUiBPVEhFUiBMSUFCSUxJVFksIFdIRVRIRVIgSU4gQU4gQUNUSU9OIE9GIENPTlRSQUNULCBUT1JUIE9SXG4vLyBPVEhFUldJU0UsIEFSSVNJTkcgRlJPTSwgT1VUIE9GIE9SIElOIENPTk5FQ1RJT04gV0lUSCBUSEUgU09GVFdBUkUgT1IgVEhFXG4vLyBVU0UgT1IgT1RIRVIgREVBTElOR1MgSU4gVEhFIFNPRlRXQVJFLlxuXG4vLyByZXNvbHZlcyAuIGFuZCAuLiBlbGVtZW50cyBpbiBhIHBhdGggYXJyYXkgd2l0aCBkaXJlY3RvcnkgbmFtZXMgdGhlcmVcbi8vIG11c3QgYmUgbm8gc2xhc2hlcywgZW1wdHkgZWxlbWVudHMsIG9yIGRldmljZSBuYW1lcyAoYzpcXCkgaW4gdGhlIGFycmF5XG4vLyAoc28gYWxzbyBubyBsZWFkaW5nIGFuZCB0cmFpbGluZyBzbGFzaGVzIC0gaXQgZG9lcyBub3QgZGlzdGluZ3Vpc2hcbi8vIHJlbGF0aXZlIGFuZCBhYnNvbHV0ZSBwYXRocylcbmZ1bmN0aW9uIG5vcm1hbGl6ZUFycmF5KHBhcnRzLCBhbGxvd0Fib3ZlUm9vdCkge1xuICAvLyBpZiB0aGUgcGF0aCB0cmllcyB0byBnbyBhYm92ZSB0aGUgcm9vdCwgYHVwYCBlbmRzIHVwID4gMFxuICB2YXIgdXAgPSAwO1xuICBmb3IgKHZhciBpID0gcGFydHMubGVuZ3RoIC0gMTsgaSA+PSAwOyBpLS0pIHtcbiAgICB2YXIgbGFzdCA9IHBhcnRzW2ldO1xuICAgIGlmIChsYXN0ID09PSAnLicpIHtcbiAgICAgIHBhcnRzLnNwbGljZShpLCAxKTtcbiAgICB9IGVsc2UgaWYgKGxhc3QgPT09ICcuLicpIHtcbiAgICAgIHBhcnRzLnNwbGljZShpLCAxKTtcbiAgICAgIHVwKys7XG4gICAgfSBlbHNlIGlmICh1cCkge1xuICAgICAgcGFydHMuc3BsaWNlKGksIDEpO1xuICAgICAgdXAtLTtcbiAgICB9XG4gIH1cblxuICAvLyBpZiB0aGUgcGF0aCBpcyBhbGxvd2VkIHRvIGdvIGFib3ZlIHRoZSByb290LCByZXN0b3JlIGxlYWRpbmcgLi5zXG4gIGlmIChhbGxvd0Fib3ZlUm9vdCkge1xuICAgIGZvciAoOyB1cC0tOyB1cCkge1xuICAgICAgcGFydHMudW5zaGlmdCgnLi4nKTtcbiAgICB9XG4gIH1cblxuICByZXR1cm4gcGFydHM7XG59XG5cbi8vIFNwbGl0IGEgZmlsZW5hbWUgaW50byBbcm9vdCwgZGlyLCBiYXNlbmFtZSwgZXh0XSwgdW5peCB2ZXJzaW9uXG4vLyAncm9vdCcgaXMganVzdCBhIHNsYXNoLCBvciBub3RoaW5nLlxudmFyIHNwbGl0UGF0aFJlID1cbiAgICAvXihcXC8/fCkoW1xcc1xcU10qPykoKD86XFwuezEsMn18W15cXC9dKz98KShcXC5bXi5cXC9dKnwpKSg/OltcXC9dKikkLztcbnZhciBzcGxpdFBhdGggPSBmdW5jdGlvbihmaWxlbmFtZSkge1xuICByZXR1cm4gc3BsaXRQYXRoUmUuZXhlYyhmaWxlbmFtZSkuc2xpY2UoMSk7XG59O1xuXG4vLyBwYXRoLnJlc29sdmUoW2Zyb20gLi4uXSwgdG8pXG4vLyBwb3NpeCB2ZXJzaW9uXG5leHBvcnRzLnJlc29sdmUgPSBmdW5jdGlvbigpIHtcbiAgdmFyIHJlc29sdmVkUGF0aCA9ICcnLFxuICAgICAgcmVzb2x2ZWRBYnNvbHV0ZSA9IGZhbHNlO1xuXG4gIGZvciAodmFyIGkgPSBhcmd1bWVudHMubGVuZ3RoIC0gMTsgaSA+PSAtMSAmJiAhcmVzb2x2ZWRBYnNvbHV0ZTsgaS0tKSB7XG4gICAgdmFyIHBhdGggPSAoaSA+PSAwKSA/IGFyZ3VtZW50c1tpXSA6IHByb2Nlc3MuY3dkKCk7XG5cbiAgICAvLyBTa2lwIGVtcHR5IGFuZCBpbnZhbGlkIGVudHJpZXNcbiAgICBpZiAodHlwZW9mIHBhdGggIT09ICdzdHJpbmcnKSB7XG4gICAgICB0aHJvdyBuZXcgVHlwZUVycm9yKCdBcmd1bWVudHMgdG8gcGF0aC5yZXNvbHZlIG11c3QgYmUgc3RyaW5ncycpO1xuICAgIH0gZWxzZSBpZiAoIXBhdGgpIHtcbiAgICAgIGNvbnRpbnVlO1xuICAgIH1cblxuICAgIHJlc29sdmVkUGF0aCA9IHBhdGggKyAnLycgKyByZXNvbHZlZFBhdGg7XG4gICAgcmVzb2x2ZWRBYnNvbHV0ZSA9IHBhdGguY2hhckF0KDApID09PSAnLyc7XG4gIH1cblxuICAvLyBBdCB0aGlzIHBvaW50IHRoZSBwYXRoIHNob3VsZCBiZSByZXNvbHZlZCB0byBhIGZ1bGwgYWJzb2x1dGUgcGF0aCwgYnV0XG4gIC8vIGhhbmRsZSByZWxhdGl2ZSBwYXRocyB0byBiZSBzYWZlIChtaWdodCBoYXBwZW4gd2hlbiBwcm9jZXNzLmN3ZCgpIGZhaWxzKVxuXG4gIC8vIE5vcm1hbGl6ZSB0aGUgcGF0aFxuICByZXNvbHZlZFBhdGggPSBub3JtYWxpemVBcnJheShmaWx0ZXIocmVzb2x2ZWRQYXRoLnNwbGl0KCcvJyksIGZ1bmN0aW9uKHApIHtcbiAgICByZXR1cm4gISFwO1xuICB9KSwgIXJlc29sdmVkQWJzb2x1dGUpLmpvaW4oJy8nKTtcblxuICByZXR1cm4gKChyZXNvbHZlZEFic29sdXRlID8gJy8nIDogJycpICsgcmVzb2x2ZWRQYXRoKSB8fCAnLic7XG59O1xuXG4vLyBwYXRoLm5vcm1hbGl6ZShwYXRoKVxuLy8gcG9zaXggdmVyc2lvblxuZXhwb3J0cy5ub3JtYWxpemUgPSBmdW5jdGlvbihwYXRoKSB7XG4gIHZhciBpc0Fic29sdXRlID0gZXhwb3J0cy5pc0Fic29sdXRlKHBhdGgpLFxuICAgICAgdHJhaWxpbmdTbGFzaCA9IHN1YnN0cihwYXRoLCAtMSkgPT09ICcvJztcblxuICAvLyBOb3JtYWxpemUgdGhlIHBhdGhcbiAgcGF0aCA9IG5vcm1hbGl6ZUFycmF5KGZpbHRlcihwYXRoLnNwbGl0KCcvJyksIGZ1bmN0aW9uKHApIHtcbiAgICByZXR1cm4gISFwO1xuICB9KSwgIWlzQWJzb2x1dGUpLmpvaW4oJy8nKTtcblxuICBpZiAoIXBhdGggJiYgIWlzQWJzb2x1dGUpIHtcbiAgICBwYXRoID0gJy4nO1xuICB9XG4gIGlmIChwYXRoICYmIHRyYWlsaW5nU2xhc2gpIHtcbiAgICBwYXRoICs9ICcvJztcbiAgfVxuXG4gIHJldHVybiAoaXNBYnNvbHV0ZSA/ICcvJyA6ICcnKSArIHBhdGg7XG59O1xuXG4vLyBwb3NpeCB2ZXJzaW9uXG5leHBvcnRzLmlzQWJzb2x1dGUgPSBmdW5jdGlvbihwYXRoKSB7XG4gIHJldHVybiBwYXRoLmNoYXJBdCgwKSA9PT0gJy8nO1xufTtcblxuLy8gcG9zaXggdmVyc2lvblxuZXhwb3J0cy5qb2luID0gZnVuY3Rpb24oKSB7XG4gIHZhciBwYXRocyA9IEFycmF5LnByb3RvdHlwZS5zbGljZS5jYWxsKGFyZ3VtZW50cywgMCk7XG4gIHJldHVybiBleHBvcnRzLm5vcm1hbGl6ZShmaWx0ZXIocGF0aHMsIGZ1bmN0aW9uKHAsIGluZGV4KSB7XG4gICAgaWYgKHR5cGVvZiBwICE9PSAnc3RyaW5nJykge1xuICAgICAgdGhyb3cgbmV3IFR5cGVFcnJvcignQXJndW1lbnRzIHRvIHBhdGguam9pbiBtdXN0IGJlIHN0cmluZ3MnKTtcbiAgICB9XG4gICAgcmV0dXJuIHA7XG4gIH0pLmpvaW4oJy8nKSk7XG59O1xuXG5cbi8vIHBhdGgucmVsYXRpdmUoZnJvbSwgdG8pXG4vLyBwb3NpeCB2ZXJzaW9uXG5leHBvcnRzLnJlbGF0aXZlID0gZnVuY3Rpb24oZnJvbSwgdG8pIHtcbiAgZnJvbSA9IGV4cG9ydHMucmVzb2x2ZShmcm9tKS5zdWJzdHIoMSk7XG4gIHRvID0gZXhwb3J0cy5yZXNvbHZlKHRvKS5zdWJzdHIoMSk7XG5cbiAgZnVuY3Rpb24gdHJpbShhcnIpIHtcbiAgICB2YXIgc3RhcnQgPSAwO1xuICAgIGZvciAoOyBzdGFydCA8IGFyci5sZW5ndGg7IHN0YXJ0KyspIHtcbiAgICAgIGlmIChhcnJbc3RhcnRdICE9PSAnJykgYnJlYWs7XG4gICAgfVxuXG4gICAgdmFyIGVuZCA9IGFyci5sZW5ndGggLSAxO1xuICAgIGZvciAoOyBlbmQgPj0gMDsgZW5kLS0pIHtcbiAgICAgIGlmIChhcnJbZW5kXSAhPT0gJycpIGJyZWFrO1xuICAgIH1cblxuICAgIGlmIChzdGFydCA+IGVuZCkgcmV0dXJuIFtdO1xuICAgIHJldHVybiBhcnIuc2xpY2Uoc3RhcnQsIGVuZCAtIHN0YXJ0ICsgMSk7XG4gIH1cblxuICB2YXIgZnJvbVBhcnRzID0gdHJpbShmcm9tLnNwbGl0KCcvJykpO1xuICB2YXIgdG9QYXJ0cyA9IHRyaW0odG8uc3BsaXQoJy8nKSk7XG5cbiAgdmFyIGxlbmd0aCA9IE1hdGgubWluKGZyb21QYXJ0cy5sZW5ndGgsIHRvUGFydHMubGVuZ3RoKTtcbiAgdmFyIHNhbWVQYXJ0c0xlbmd0aCA9IGxlbmd0aDtcbiAgZm9yICh2YXIgaSA9IDA7IGkgPCBsZW5ndGg7IGkrKykge1xuICAgIGlmIChmcm9tUGFydHNbaV0gIT09IHRvUGFydHNbaV0pIHtcbiAgICAgIHNhbWVQYXJ0c0xlbmd0aCA9IGk7XG4gICAgICBicmVhaztcbiAgICB9XG4gIH1cblxuICB2YXIgb3V0cHV0UGFydHMgPSBbXTtcbiAgZm9yICh2YXIgaSA9IHNhbWVQYXJ0c0xlbmd0aDsgaSA8IGZyb21QYXJ0cy5sZW5ndGg7IGkrKykge1xuICAgIG91dHB1dFBhcnRzLnB1c2goJy4uJyk7XG4gIH1cblxuICBvdXRwdXRQYXJ0cyA9IG91dHB1dFBhcnRzLmNvbmNhdCh0b1BhcnRzLnNsaWNlKHNhbWVQYXJ0c0xlbmd0aCkpO1xuXG4gIHJldHVybiBvdXRwdXRQYXJ0cy5qb2luKCcvJyk7XG59O1xuXG5leHBvcnRzLnNlcCA9ICcvJztcbmV4cG9ydHMuZGVsaW1pdGVyID0gJzonO1xuXG5leHBvcnRzLmRpcm5hbWUgPSBmdW5jdGlvbihwYXRoKSB7XG4gIHZhciByZXN1bHQgPSBzcGxpdFBhdGgocGF0aCksXG4gICAgICByb290ID0gcmVzdWx0WzBdLFxuICAgICAgZGlyID0gcmVzdWx0WzFdO1xuXG4gIGlmICghcm9vdCAmJiAhZGlyKSB7XG4gICAgLy8gTm8gZGlybmFtZSB3aGF0c29ldmVyXG4gICAgcmV0dXJuICcuJztcbiAgfVxuXG4gIGlmIChkaXIpIHtcbiAgICAvLyBJdCBoYXMgYSBkaXJuYW1lLCBzdHJpcCB0cmFpbGluZyBzbGFzaFxuICAgIGRpciA9IGRpci5zdWJzdHIoMCwgZGlyLmxlbmd0aCAtIDEpO1xuICB9XG5cbiAgcmV0dXJuIHJvb3QgKyBkaXI7XG59O1xuXG5cbmV4cG9ydHMuYmFzZW5hbWUgPSBmdW5jdGlvbihwYXRoLCBleHQpIHtcbiAgdmFyIGYgPSBzcGxpdFBhdGgocGF0aClbMl07XG4gIC8vIFRPRE86IG1ha2UgdGhpcyBjb21wYXJpc29uIGNhc2UtaW5zZW5zaXRpdmUgb24gd2luZG93cz9cbiAgaWYgKGV4dCAmJiBmLnN1YnN0cigtMSAqIGV4dC5sZW5ndGgpID09PSBleHQpIHtcbiAgICBmID0gZi5zdWJzdHIoMCwgZi5sZW5ndGggLSBleHQubGVuZ3RoKTtcbiAgfVxuICByZXR1cm4gZjtcbn07XG5cblxuZXhwb3J0cy5leHRuYW1lID0gZnVuY3Rpb24ocGF0aCkge1xuICByZXR1cm4gc3BsaXRQYXRoKHBhdGgpWzNdO1xufTtcblxuZnVuY3Rpb24gZmlsdGVyICh4cywgZikge1xuICAgIGlmICh4cy5maWx0ZXIpIHJldHVybiB4cy5maWx0ZXIoZik7XG4gICAgdmFyIHJlcyA9IFtdO1xuICAgIGZvciAodmFyIGkgPSAwOyBpIDwgeHMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgaWYgKGYoeHNbaV0sIGksIHhzKSkgcmVzLnB1c2goeHNbaV0pO1xuICAgIH1cbiAgICByZXR1cm4gcmVzO1xufVxuXG4vLyBTdHJpbmcucHJvdG90eXBlLnN1YnN0ciAtIG5lZ2F0aXZlIGluZGV4IGRvbid0IHdvcmsgaW4gSUU4XG52YXIgc3Vic3RyID0gJ2FiJy5zdWJzdHIoLTEpID09PSAnYidcbiAgICA/IGZ1bmN0aW9uIChzdHIsIHN0YXJ0LCBsZW4pIHsgcmV0dXJuIHN0ci5zdWJzdHIoc3RhcnQsIGxlbikgfVxuICAgIDogZnVuY3Rpb24gKHN0ciwgc3RhcnQsIGxlbikge1xuICAgICAgICBpZiAoc3RhcnQgPCAwKSBzdGFydCA9IHN0ci5sZW5ndGggKyBzdGFydDtcbiAgICAgICAgcmV0dXJuIHN0ci5zdWJzdHIoc3RhcnQsIGxlbik7XG4gICAgfVxuO1xuIiwiLy8gc2hpbSBmb3IgdXNpbmcgcHJvY2VzcyBpbiBicm93c2VyXG5cbnZhciBwcm9jZXNzID0gbW9kdWxlLmV4cG9ydHMgPSB7fTtcbnZhciBxdWV1ZSA9IFtdO1xudmFyIGRyYWluaW5nID0gZmFsc2U7XG52YXIgY3VycmVudFF1ZXVlO1xudmFyIHF1ZXVlSW5kZXggPSAtMTtcblxuZnVuY3Rpb24gY2xlYW5VcE5leHRUaWNrKCkge1xuICAgIGRyYWluaW5nID0gZmFsc2U7XG4gICAgaWYgKGN1cnJlbnRRdWV1ZS5sZW5ndGgpIHtcbiAgICAgICAgcXVldWUgPSBjdXJyZW50UXVldWUuY29uY2F0KHF1ZXVlKTtcbiAgICB9IGVsc2Uge1xuICAgICAgICBxdWV1ZUluZGV4ID0gLTE7XG4gICAgfVxuICAgIGlmIChxdWV1ZS5sZW5ndGgpIHtcbiAgICAgICAgZHJhaW5RdWV1ZSgpO1xuICAgIH1cbn1cblxuZnVuY3Rpb24gZHJhaW5RdWV1ZSgpIHtcbiAgICBpZiAoZHJhaW5pbmcpIHtcbiAgICAgICAgcmV0dXJuO1xuICAgIH1cbiAgICB2YXIgdGltZW91dCA9IHNldFRpbWVvdXQoY2xlYW5VcE5leHRUaWNrKTtcbiAgICBkcmFpbmluZyA9IHRydWU7XG5cbiAgICB2YXIgbGVuID0gcXVldWUubGVuZ3RoO1xuICAgIHdoaWxlKGxlbikge1xuICAgICAgICBjdXJyZW50UXVldWUgPSBxdWV1ZTtcbiAgICAgICAgcXVldWUgPSBbXTtcbiAgICAgICAgd2hpbGUgKCsrcXVldWVJbmRleCA8IGxlbikge1xuICAgICAgICAgICAgaWYgKGN1cnJlbnRRdWV1ZSkge1xuICAgICAgICAgICAgICAgIGN1cnJlbnRRdWV1ZVtxdWV1ZUluZGV4XS5ydW4oKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICBxdWV1ZUluZGV4ID0gLTE7XG4gICAgICAgIGxlbiA9IHF1ZXVlLmxlbmd0aDtcbiAgICB9XG4gICAgY3VycmVudFF1ZXVlID0gbnVsbDtcbiAgICBkcmFpbmluZyA9IGZhbHNlO1xuICAgIGNsZWFyVGltZW91dCh0aW1lb3V0KTtcbn1cblxucHJvY2Vzcy5uZXh0VGljayA9IGZ1bmN0aW9uIChmdW4pIHtcbiAgICB2YXIgYXJncyA9IG5ldyBBcnJheShhcmd1bWVudHMubGVuZ3RoIC0gMSk7XG4gICAgaWYgKGFyZ3VtZW50cy5sZW5ndGggPiAxKSB7XG4gICAgICAgIGZvciAodmFyIGkgPSAxOyBpIDwgYXJndW1lbnRzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICBhcmdzW2kgLSAxXSA9IGFyZ3VtZW50c1tpXTtcbiAgICAgICAgfVxuICAgIH1cbiAgICBxdWV1ZS5wdXNoKG5ldyBJdGVtKGZ1biwgYXJncykpO1xuICAgIGlmIChxdWV1ZS5sZW5ndGggPT09IDEgJiYgIWRyYWluaW5nKSB7XG4gICAgICAgIHNldFRpbWVvdXQoZHJhaW5RdWV1ZSwgMCk7XG4gICAgfVxufTtcblxuLy8gdjggbGlrZXMgcHJlZGljdGlibGUgb2JqZWN0c1xuZnVuY3Rpb24gSXRlbShmdW4sIGFycmF5KSB7XG4gICAgdGhpcy5mdW4gPSBmdW47XG4gICAgdGhpcy5hcnJheSA9IGFycmF5O1xufVxuSXRlbS5wcm90b3R5cGUucnVuID0gZnVuY3Rpb24gKCkge1xuICAgIHRoaXMuZnVuLmFwcGx5KG51bGwsIHRoaXMuYXJyYXkpO1xufTtcbnByb2Nlc3MudGl0bGUgPSAnYnJvd3Nlcic7XG5wcm9jZXNzLmJyb3dzZXIgPSB0cnVlO1xucHJvY2Vzcy5lbnYgPSB7fTtcbnByb2Nlc3MuYXJndiA9IFtdO1xucHJvY2Vzcy52ZXJzaW9uID0gJyc7IC8vIGVtcHR5IHN0cmluZyB0byBhdm9pZCByZWdleHAgaXNzdWVzXG5wcm9jZXNzLnZlcnNpb25zID0ge307XG5cbmZ1bmN0aW9uIG5vb3AoKSB7fVxuXG5wcm9jZXNzLm9uID0gbm9vcDtcbnByb2Nlc3MuYWRkTGlzdGVuZXIgPSBub29wO1xucHJvY2Vzcy5vbmNlID0gbm9vcDtcbnByb2Nlc3Mub2ZmID0gbm9vcDtcbnByb2Nlc3MucmVtb3ZlTGlzdGVuZXIgPSBub29wO1xucHJvY2Vzcy5yZW1vdmVBbGxMaXN0ZW5lcnMgPSBub29wO1xucHJvY2Vzcy5lbWl0ID0gbm9vcDtcblxucHJvY2Vzcy5iaW5kaW5nID0gZnVuY3Rpb24gKG5hbWUpIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoJ3Byb2Nlc3MuYmluZGluZyBpcyBub3Qgc3VwcG9ydGVkJyk7XG59O1xuXG5wcm9jZXNzLmN3ZCA9IGZ1bmN0aW9uICgpIHsgcmV0dXJuICcvJyB9O1xucHJvY2Vzcy5jaGRpciA9IGZ1bmN0aW9uIChkaXIpIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoJ3Byb2Nlc3MuY2hkaXIgaXMgbm90IHN1cHBvcnRlZCcpO1xufTtcbnByb2Nlc3MudW1hc2sgPSBmdW5jdGlvbigpIHsgcmV0dXJuIDA7IH07XG4iLCJtb2R1bGUuZXhwb3J0cyA9IHJlcXVpcmUoXCIuL2xpYi9fc3RyZWFtX2R1cGxleC5qc1wiKVxuIiwiLy8gYSBkdXBsZXggc3RyZWFtIGlzIGp1c3QgYSBzdHJlYW0gdGhhdCBpcyBib3RoIHJlYWRhYmxlIGFuZCB3cml0YWJsZS5cbi8vIFNpbmNlIEpTIGRvZXNuJ3QgaGF2ZSBtdWx0aXBsZSBwcm90b3R5cGFsIGluaGVyaXRhbmNlLCB0aGlzIGNsYXNzXG4vLyBwcm90b3R5cGFsbHkgaW5oZXJpdHMgZnJvbSBSZWFkYWJsZSwgYW5kIHRoZW4gcGFyYXNpdGljYWxseSBmcm9tXG4vLyBXcml0YWJsZS5cblxuJ3VzZSBzdHJpY3QnO1xuXG4vKjxyZXBsYWNlbWVudD4qL1xudmFyIG9iamVjdEtleXMgPSBPYmplY3Qua2V5cyB8fCBmdW5jdGlvbiAob2JqKSB7XG4gIHZhciBrZXlzID0gW107XG4gIGZvciAodmFyIGtleSBpbiBvYmopIGtleXMucHVzaChrZXkpO1xuICByZXR1cm4ga2V5cztcbn1cbi8qPC9yZXBsYWNlbWVudD4qL1xuXG5cbm1vZHVsZS5leHBvcnRzID0gRHVwbGV4O1xuXG4vKjxyZXBsYWNlbWVudD4qL1xudmFyIHByb2Nlc3NOZXh0VGljayA9IHJlcXVpcmUoJ3Byb2Nlc3MtbmV4dGljay1hcmdzJyk7XG4vKjwvcmVwbGFjZW1lbnQ+Ki9cblxuXG5cbi8qPHJlcGxhY2VtZW50PiovXG52YXIgdXRpbCA9IHJlcXVpcmUoJ2NvcmUtdXRpbC1pcycpO1xudXRpbC5pbmhlcml0cyA9IHJlcXVpcmUoJ2luaGVyaXRzJyk7XG4vKjwvcmVwbGFjZW1lbnQ+Ki9cblxudmFyIFJlYWRhYmxlID0gcmVxdWlyZSgnLi9fc3RyZWFtX3JlYWRhYmxlJyk7XG52YXIgV3JpdGFibGUgPSByZXF1aXJlKCcuL19zdHJlYW1fd3JpdGFibGUnKTtcblxudXRpbC5pbmhlcml0cyhEdXBsZXgsIFJlYWRhYmxlKTtcblxudmFyIGtleXMgPSBvYmplY3RLZXlzKFdyaXRhYmxlLnByb3RvdHlwZSk7XG5mb3IgKHZhciB2ID0gMDsgdiA8IGtleXMubGVuZ3RoOyB2KyspIHtcbiAgdmFyIG1ldGhvZCA9IGtleXNbdl07XG4gIGlmICghRHVwbGV4LnByb3RvdHlwZVttZXRob2RdKVxuICAgIER1cGxleC5wcm90b3R5cGVbbWV0aG9kXSA9IFdyaXRhYmxlLnByb3RvdHlwZVttZXRob2RdO1xufVxuXG5mdW5jdGlvbiBEdXBsZXgob3B0aW9ucykge1xuICBpZiAoISh0aGlzIGluc3RhbmNlb2YgRHVwbGV4KSlcbiAgICByZXR1cm4gbmV3IER1cGxleChvcHRpb25zKTtcblxuICBSZWFkYWJsZS5jYWxsKHRoaXMsIG9wdGlvbnMpO1xuICBXcml0YWJsZS5jYWxsKHRoaXMsIG9wdGlvbnMpO1xuXG4gIGlmIChvcHRpb25zICYmIG9wdGlvbnMucmVhZGFibGUgPT09IGZhbHNlKVxuICAgIHRoaXMucmVhZGFibGUgPSBmYWxzZTtcblxuICBpZiAob3B0aW9ucyAmJiBvcHRpb25zLndyaXRhYmxlID09PSBmYWxzZSlcbiAgICB0aGlzLndyaXRhYmxlID0gZmFsc2U7XG5cbiAgdGhpcy5hbGxvd0hhbGZPcGVuID0gdHJ1ZTtcbiAgaWYgKG9wdGlvbnMgJiYgb3B0aW9ucy5hbGxvd0hhbGZPcGVuID09PSBmYWxzZSlcbiAgICB0aGlzLmFsbG93SGFsZk9wZW4gPSBmYWxzZTtcblxuICB0aGlzLm9uY2UoJ2VuZCcsIG9uZW5kKTtcbn1cblxuLy8gdGhlIG5vLWhhbGYtb3BlbiBlbmZvcmNlclxuZnVuY3Rpb24gb25lbmQoKSB7XG4gIC8vIGlmIHdlIGFsbG93IGhhbGYtb3BlbiBzdGF0ZSwgb3IgaWYgdGhlIHdyaXRhYmxlIHNpZGUgZW5kZWQsXG4gIC8vIHRoZW4gd2UncmUgb2suXG4gIGlmICh0aGlzLmFsbG93SGFsZk9wZW4gfHwgdGhpcy5fd3JpdGFibGVTdGF0ZS5lbmRlZClcbiAgICByZXR1cm47XG5cbiAgLy8gbm8gbW9yZSBkYXRhIGNhbiBiZSB3cml0dGVuLlxuICAvLyBCdXQgYWxsb3cgbW9yZSB3cml0ZXMgdG8gaGFwcGVuIGluIHRoaXMgdGljay5cbiAgcHJvY2Vzc05leHRUaWNrKG9uRW5kTlQsIHRoaXMpO1xufVxuXG5mdW5jdGlvbiBvbkVuZE5UKHNlbGYpIHtcbiAgc2VsZi5lbmQoKTtcbn1cblxuZnVuY3Rpb24gZm9yRWFjaCAoeHMsIGYpIHtcbiAgZm9yICh2YXIgaSA9IDAsIGwgPSB4cy5sZW5ndGg7IGkgPCBsOyBpKyspIHtcbiAgICBmKHhzW2ldLCBpKTtcbiAgfVxufVxuIiwiLy8gYSBwYXNzdGhyb3VnaCBzdHJlYW0uXG4vLyBiYXNpY2FsbHkganVzdCB0aGUgbW9zdCBtaW5pbWFsIHNvcnQgb2YgVHJhbnNmb3JtIHN0cmVhbS5cbi8vIEV2ZXJ5IHdyaXR0ZW4gY2h1bmsgZ2V0cyBvdXRwdXQgYXMtaXMuXG5cbid1c2Ugc3RyaWN0JztcblxubW9kdWxlLmV4cG9ydHMgPSBQYXNzVGhyb3VnaDtcblxudmFyIFRyYW5zZm9ybSA9IHJlcXVpcmUoJy4vX3N0cmVhbV90cmFuc2Zvcm0nKTtcblxuLyo8cmVwbGFjZW1lbnQ+Ki9cbnZhciB1dGlsID0gcmVxdWlyZSgnY29yZS11dGlsLWlzJyk7XG51dGlsLmluaGVyaXRzID0gcmVxdWlyZSgnaW5oZXJpdHMnKTtcbi8qPC9yZXBsYWNlbWVudD4qL1xuXG51dGlsLmluaGVyaXRzKFBhc3NUaHJvdWdoLCBUcmFuc2Zvcm0pO1xuXG5mdW5jdGlvbiBQYXNzVGhyb3VnaChvcHRpb25zKSB7XG4gIGlmICghKHRoaXMgaW5zdGFuY2VvZiBQYXNzVGhyb3VnaCkpXG4gICAgcmV0dXJuIG5ldyBQYXNzVGhyb3VnaChvcHRpb25zKTtcblxuICBUcmFuc2Zvcm0uY2FsbCh0aGlzLCBvcHRpb25zKTtcbn1cblxuUGFzc1Rocm91Z2gucHJvdG90eXBlLl90cmFuc2Zvcm0gPSBmdW5jdGlvbihjaHVuaywgZW5jb2RpbmcsIGNiKSB7XG4gIGNiKG51bGwsIGNodW5rKTtcbn07XG4iLCIndXNlIHN0cmljdCc7XG5cbm1vZHVsZS5leHBvcnRzID0gUmVhZGFibGU7XG5cbi8qPHJlcGxhY2VtZW50PiovXG52YXIgcHJvY2Vzc05leHRUaWNrID0gcmVxdWlyZSgncHJvY2Vzcy1uZXh0aWNrLWFyZ3MnKTtcbi8qPC9yZXBsYWNlbWVudD4qL1xuXG5cbi8qPHJlcGxhY2VtZW50PiovXG52YXIgaXNBcnJheSA9IHJlcXVpcmUoJ2lzYXJyYXknKTtcbi8qPC9yZXBsYWNlbWVudD4qL1xuXG5cbi8qPHJlcGxhY2VtZW50PiovXG52YXIgQnVmZmVyID0gcmVxdWlyZSgnYnVmZmVyJykuQnVmZmVyO1xuLyo8L3JlcGxhY2VtZW50PiovXG5cblJlYWRhYmxlLlJlYWRhYmxlU3RhdGUgPSBSZWFkYWJsZVN0YXRlO1xuXG52YXIgRUUgPSByZXF1aXJlKCdldmVudHMnKTtcblxuLyo8cmVwbGFjZW1lbnQ+Ki9cbnZhciBFRWxpc3RlbmVyQ291bnQgPSBmdW5jdGlvbihlbWl0dGVyLCB0eXBlKSB7XG4gIHJldHVybiBlbWl0dGVyLmxpc3RlbmVycyh0eXBlKS5sZW5ndGg7XG59O1xuLyo8L3JlcGxhY2VtZW50PiovXG5cblxuXG4vKjxyZXBsYWNlbWVudD4qL1xudmFyIFN0cmVhbTtcbihmdW5jdGlvbiAoKXt0cnl7XG4gIFN0cmVhbSA9IHJlcXVpcmUoJ3N0JyArICdyZWFtJyk7XG59Y2F0Y2goXyl7fWZpbmFsbHl7XG4gIGlmICghU3RyZWFtKVxuICAgIFN0cmVhbSA9IHJlcXVpcmUoJ2V2ZW50cycpLkV2ZW50RW1pdHRlcjtcbn19KCkpXG4vKjwvcmVwbGFjZW1lbnQ+Ki9cblxudmFyIEJ1ZmZlciA9IHJlcXVpcmUoJ2J1ZmZlcicpLkJ1ZmZlcjtcblxuLyo8cmVwbGFjZW1lbnQ+Ki9cbnZhciB1dGlsID0gcmVxdWlyZSgnY29yZS11dGlsLWlzJyk7XG51dGlsLmluaGVyaXRzID0gcmVxdWlyZSgnaW5oZXJpdHMnKTtcbi8qPC9yZXBsYWNlbWVudD4qL1xuXG5cblxuLyo8cmVwbGFjZW1lbnQ+Ki9cbnZhciBkZWJ1Z1V0aWwgPSByZXF1aXJlKCd1dGlsJyk7XG52YXIgZGVidWc7XG5pZiAoZGVidWdVdGlsICYmIGRlYnVnVXRpbC5kZWJ1Z2xvZykge1xuICBkZWJ1ZyA9IGRlYnVnVXRpbC5kZWJ1Z2xvZygnc3RyZWFtJyk7XG59IGVsc2Uge1xuICBkZWJ1ZyA9IGZ1bmN0aW9uICgpIHt9O1xufVxuLyo8L3JlcGxhY2VtZW50PiovXG5cbnZhciBTdHJpbmdEZWNvZGVyO1xuXG51dGlsLmluaGVyaXRzKFJlYWRhYmxlLCBTdHJlYW0pO1xuXG52YXIgRHVwbGV4O1xuZnVuY3Rpb24gUmVhZGFibGVTdGF0ZShvcHRpb25zLCBzdHJlYW0pIHtcbiAgRHVwbGV4ID0gRHVwbGV4IHx8IHJlcXVpcmUoJy4vX3N0cmVhbV9kdXBsZXgnKTtcblxuICBvcHRpb25zID0gb3B0aW9ucyB8fCB7fTtcblxuICAvLyBvYmplY3Qgc3RyZWFtIGZsYWcuIFVzZWQgdG8gbWFrZSByZWFkKG4pIGlnbm9yZSBuIGFuZCB0b1xuICAvLyBtYWtlIGFsbCB0aGUgYnVmZmVyIG1lcmdpbmcgYW5kIGxlbmd0aCBjaGVja3MgZ28gYXdheVxuICB0aGlzLm9iamVjdE1vZGUgPSAhIW9wdGlvbnMub2JqZWN0TW9kZTtcblxuICBpZiAoc3RyZWFtIGluc3RhbmNlb2YgRHVwbGV4KVxuICAgIHRoaXMub2JqZWN0TW9kZSA9IHRoaXMub2JqZWN0TW9kZSB8fCAhIW9wdGlvbnMucmVhZGFibGVPYmplY3RNb2RlO1xuXG4gIC8vIHRoZSBwb2ludCBhdCB3aGljaCBpdCBzdG9wcyBjYWxsaW5nIF9yZWFkKCkgdG8gZmlsbCB0aGUgYnVmZmVyXG4gIC8vIE5vdGU6IDAgaXMgYSB2YWxpZCB2YWx1ZSwgbWVhbnMgXCJkb24ndCBjYWxsIF9yZWFkIHByZWVtcHRpdmVseSBldmVyXCJcbiAgdmFyIGh3bSA9IG9wdGlvbnMuaGlnaFdhdGVyTWFyaztcbiAgdmFyIGRlZmF1bHRId20gPSB0aGlzLm9iamVjdE1vZGUgPyAxNiA6IDE2ICogMTAyNDtcbiAgdGhpcy5oaWdoV2F0ZXJNYXJrID0gKGh3bSB8fCBod20gPT09IDApID8gaHdtIDogZGVmYXVsdEh3bTtcblxuICAvLyBjYXN0IHRvIGludHMuXG4gIHRoaXMuaGlnaFdhdGVyTWFyayA9IH5+dGhpcy5oaWdoV2F0ZXJNYXJrO1xuXG4gIHRoaXMuYnVmZmVyID0gW107XG4gIHRoaXMubGVuZ3RoID0gMDtcbiAgdGhpcy5waXBlcyA9IG51bGw7XG4gIHRoaXMucGlwZXNDb3VudCA9IDA7XG4gIHRoaXMuZmxvd2luZyA9IG51bGw7XG4gIHRoaXMuZW5kZWQgPSBmYWxzZTtcbiAgdGhpcy5lbmRFbWl0dGVkID0gZmFsc2U7XG4gIHRoaXMucmVhZGluZyA9IGZhbHNlO1xuXG4gIC8vIGEgZmxhZyB0byBiZSBhYmxlIHRvIHRlbGwgaWYgdGhlIG9ud3JpdGUgY2IgaXMgY2FsbGVkIGltbWVkaWF0ZWx5LFxuICAvLyBvciBvbiBhIGxhdGVyIHRpY2suICBXZSBzZXQgdGhpcyB0byB0cnVlIGF0IGZpcnN0LCBiZWNhdXNlIGFueVxuICAvLyBhY3Rpb25zIHRoYXQgc2hvdWxkbid0IGhhcHBlbiB1bnRpbCBcImxhdGVyXCIgc2hvdWxkIGdlbmVyYWxseSBhbHNvXG4gIC8vIG5vdCBoYXBwZW4gYmVmb3JlIHRoZSBmaXJzdCB3cml0ZSBjYWxsLlxuICB0aGlzLnN5bmMgPSB0cnVlO1xuXG4gIC8vIHdoZW5ldmVyIHdlIHJldHVybiBudWxsLCB0aGVuIHdlIHNldCBhIGZsYWcgdG8gc2F5XG4gIC8vIHRoYXQgd2UncmUgYXdhaXRpbmcgYSAncmVhZGFibGUnIGV2ZW50IGVtaXNzaW9uLlxuICB0aGlzLm5lZWRSZWFkYWJsZSA9IGZhbHNlO1xuICB0aGlzLmVtaXR0ZWRSZWFkYWJsZSA9IGZhbHNlO1xuICB0aGlzLnJlYWRhYmxlTGlzdGVuaW5nID0gZmFsc2U7XG5cbiAgLy8gQ3J5cHRvIGlzIGtpbmQgb2Ygb2xkIGFuZCBjcnVzdHkuICBIaXN0b3JpY2FsbHksIGl0cyBkZWZhdWx0IHN0cmluZ1xuICAvLyBlbmNvZGluZyBpcyAnYmluYXJ5JyBzbyB3ZSBoYXZlIHRvIG1ha2UgdGhpcyBjb25maWd1cmFibGUuXG4gIC8vIEV2ZXJ5dGhpbmcgZWxzZSBpbiB0aGUgdW5pdmVyc2UgdXNlcyAndXRmOCcsIHRob3VnaC5cbiAgdGhpcy5kZWZhdWx0RW5jb2RpbmcgPSBvcHRpb25zLmRlZmF1bHRFbmNvZGluZyB8fCAndXRmOCc7XG5cbiAgLy8gd2hlbiBwaXBpbmcsIHdlIG9ubHkgY2FyZSBhYm91dCAncmVhZGFibGUnIGV2ZW50cyB0aGF0IGhhcHBlblxuICAvLyBhZnRlciByZWFkKClpbmcgYWxsIHRoZSBieXRlcyBhbmQgbm90IGdldHRpbmcgYW55IHB1c2hiYWNrLlxuICB0aGlzLnJhbk91dCA9IGZhbHNlO1xuXG4gIC8vIHRoZSBudW1iZXIgb2Ygd3JpdGVycyB0aGF0IGFyZSBhd2FpdGluZyBhIGRyYWluIGV2ZW50IGluIC5waXBlKClzXG4gIHRoaXMuYXdhaXREcmFpbiA9IDA7XG5cbiAgLy8gaWYgdHJ1ZSwgYSBtYXliZVJlYWRNb3JlIGhhcyBiZWVuIHNjaGVkdWxlZFxuICB0aGlzLnJlYWRpbmdNb3JlID0gZmFsc2U7XG5cbiAgdGhpcy5kZWNvZGVyID0gbnVsbDtcbiAgdGhpcy5lbmNvZGluZyA9IG51bGw7XG4gIGlmIChvcHRpb25zLmVuY29kaW5nKSB7XG4gICAgaWYgKCFTdHJpbmdEZWNvZGVyKVxuICAgICAgU3RyaW5nRGVjb2RlciA9IHJlcXVpcmUoJ3N0cmluZ19kZWNvZGVyLycpLlN0cmluZ0RlY29kZXI7XG4gICAgdGhpcy5kZWNvZGVyID0gbmV3IFN0cmluZ0RlY29kZXIob3B0aW9ucy5lbmNvZGluZyk7XG4gICAgdGhpcy5lbmNvZGluZyA9IG9wdGlvbnMuZW5jb2Rpbmc7XG4gIH1cbn1cblxudmFyIER1cGxleDtcbmZ1bmN0aW9uIFJlYWRhYmxlKG9wdGlvbnMpIHtcbiAgRHVwbGV4ID0gRHVwbGV4IHx8IHJlcXVpcmUoJy4vX3N0cmVhbV9kdXBsZXgnKTtcblxuICBpZiAoISh0aGlzIGluc3RhbmNlb2YgUmVhZGFibGUpKVxuICAgIHJldHVybiBuZXcgUmVhZGFibGUob3B0aW9ucyk7XG5cbiAgdGhpcy5fcmVhZGFibGVTdGF0ZSA9IG5ldyBSZWFkYWJsZVN0YXRlKG9wdGlvbnMsIHRoaXMpO1xuXG4gIC8vIGxlZ2FjeVxuICB0aGlzLnJlYWRhYmxlID0gdHJ1ZTtcblxuICBpZiAob3B0aW9ucyAmJiB0eXBlb2Ygb3B0aW9ucy5yZWFkID09PSAnZnVuY3Rpb24nKVxuICAgIHRoaXMuX3JlYWQgPSBvcHRpb25zLnJlYWQ7XG5cbiAgU3RyZWFtLmNhbGwodGhpcyk7XG59XG5cbi8vIE1hbnVhbGx5IHNob3ZlIHNvbWV0aGluZyBpbnRvIHRoZSByZWFkKCkgYnVmZmVyLlxuLy8gVGhpcyByZXR1cm5zIHRydWUgaWYgdGhlIGhpZ2hXYXRlck1hcmsgaGFzIG5vdCBiZWVuIGhpdCB5ZXQsXG4vLyBzaW1pbGFyIHRvIGhvdyBXcml0YWJsZS53cml0ZSgpIHJldHVybnMgdHJ1ZSBpZiB5b3Ugc2hvdWxkXG4vLyB3cml0ZSgpIHNvbWUgbW9yZS5cblJlYWRhYmxlLnByb3RvdHlwZS5wdXNoID0gZnVuY3Rpb24oY2h1bmssIGVuY29kaW5nKSB7XG4gIHZhciBzdGF0ZSA9IHRoaXMuX3JlYWRhYmxlU3RhdGU7XG5cbiAgaWYgKCFzdGF0ZS5vYmplY3RNb2RlICYmIHR5cGVvZiBjaHVuayA9PT0gJ3N0cmluZycpIHtcbiAgICBlbmNvZGluZyA9IGVuY29kaW5nIHx8IHN0YXRlLmRlZmF1bHRFbmNvZGluZztcbiAgICBpZiAoZW5jb2RpbmcgIT09IHN0YXRlLmVuY29kaW5nKSB7XG4gICAgICBjaHVuayA9IG5ldyBCdWZmZXIoY2h1bmssIGVuY29kaW5nKTtcbiAgICAgIGVuY29kaW5nID0gJyc7XG4gICAgfVxuICB9XG5cbiAgcmV0dXJuIHJlYWRhYmxlQWRkQ2h1bmsodGhpcywgc3RhdGUsIGNodW5rLCBlbmNvZGluZywgZmFsc2UpO1xufTtcblxuLy8gVW5zaGlmdCBzaG91bGQgKmFsd2F5cyogYmUgc29tZXRoaW5nIGRpcmVjdGx5IG91dCBvZiByZWFkKClcblJlYWRhYmxlLnByb3RvdHlwZS51bnNoaWZ0ID0gZnVuY3Rpb24oY2h1bmspIHtcbiAgdmFyIHN0YXRlID0gdGhpcy5fcmVhZGFibGVTdGF0ZTtcbiAgcmV0dXJuIHJlYWRhYmxlQWRkQ2h1bmsodGhpcywgc3RhdGUsIGNodW5rLCAnJywgdHJ1ZSk7XG59O1xuXG5SZWFkYWJsZS5wcm90b3R5cGUuaXNQYXVzZWQgPSBmdW5jdGlvbigpIHtcbiAgcmV0dXJuIHRoaXMuX3JlYWRhYmxlU3RhdGUuZmxvd2luZyA9PT0gZmFsc2U7XG59O1xuXG5mdW5jdGlvbiByZWFkYWJsZUFkZENodW5rKHN0cmVhbSwgc3RhdGUsIGNodW5rLCBlbmNvZGluZywgYWRkVG9Gcm9udCkge1xuICB2YXIgZXIgPSBjaHVua0ludmFsaWQoc3RhdGUsIGNodW5rKTtcbiAgaWYgKGVyKSB7XG4gICAgc3RyZWFtLmVtaXQoJ2Vycm9yJywgZXIpO1xuICB9IGVsc2UgaWYgKGNodW5rID09PSBudWxsKSB7XG4gICAgc3RhdGUucmVhZGluZyA9IGZhbHNlO1xuICAgIG9uRW9mQ2h1bmsoc3RyZWFtLCBzdGF0ZSk7XG4gIH0gZWxzZSBpZiAoc3RhdGUub2JqZWN0TW9kZSB8fCBjaHVuayAmJiBjaHVuay5sZW5ndGggPiAwKSB7XG4gICAgaWYgKHN0YXRlLmVuZGVkICYmICFhZGRUb0Zyb250KSB7XG4gICAgICB2YXIgZSA9IG5ldyBFcnJvcignc3RyZWFtLnB1c2goKSBhZnRlciBFT0YnKTtcbiAgICAgIHN0cmVhbS5lbWl0KCdlcnJvcicsIGUpO1xuICAgIH0gZWxzZSBpZiAoc3RhdGUuZW5kRW1pdHRlZCAmJiBhZGRUb0Zyb250KSB7XG4gICAgICB2YXIgZSA9IG5ldyBFcnJvcignc3RyZWFtLnVuc2hpZnQoKSBhZnRlciBlbmQgZXZlbnQnKTtcbiAgICAgIHN0cmVhbS5lbWl0KCdlcnJvcicsIGUpO1xuICAgIH0gZWxzZSB7XG4gICAgICBpZiAoc3RhdGUuZGVjb2RlciAmJiAhYWRkVG9Gcm9udCAmJiAhZW5jb2RpbmcpXG4gICAgICAgIGNodW5rID0gc3RhdGUuZGVjb2Rlci53cml0ZShjaHVuayk7XG5cbiAgICAgIGlmICghYWRkVG9Gcm9udClcbiAgICAgICAgc3RhdGUucmVhZGluZyA9IGZhbHNlO1xuXG4gICAgICAvLyBpZiB3ZSB3YW50IHRoZSBkYXRhIG5vdywganVzdCBlbWl0IGl0LlxuICAgICAgaWYgKHN0YXRlLmZsb3dpbmcgJiYgc3RhdGUubGVuZ3RoID09PSAwICYmICFzdGF0ZS5zeW5jKSB7XG4gICAgICAgIHN0cmVhbS5lbWl0KCdkYXRhJywgY2h1bmspO1xuICAgICAgICBzdHJlYW0ucmVhZCgwKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIC8vIHVwZGF0ZSB0aGUgYnVmZmVyIGluZm8uXG4gICAgICAgIHN0YXRlLmxlbmd0aCArPSBzdGF0ZS5vYmplY3RNb2RlID8gMSA6IGNodW5rLmxlbmd0aDtcbiAgICAgICAgaWYgKGFkZFRvRnJvbnQpXG4gICAgICAgICAgc3RhdGUuYnVmZmVyLnVuc2hpZnQoY2h1bmspO1xuICAgICAgICBlbHNlXG4gICAgICAgICAgc3RhdGUuYnVmZmVyLnB1c2goY2h1bmspO1xuXG4gICAgICAgIGlmIChzdGF0ZS5uZWVkUmVhZGFibGUpXG4gICAgICAgICAgZW1pdFJlYWRhYmxlKHN0cmVhbSk7XG4gICAgICB9XG5cbiAgICAgIG1heWJlUmVhZE1vcmUoc3RyZWFtLCBzdGF0ZSk7XG4gICAgfVxuICB9IGVsc2UgaWYgKCFhZGRUb0Zyb250KSB7XG4gICAgc3RhdGUucmVhZGluZyA9IGZhbHNlO1xuICB9XG5cbiAgcmV0dXJuIG5lZWRNb3JlRGF0YShzdGF0ZSk7XG59XG5cblxuLy8gaWYgaXQncyBwYXN0IHRoZSBoaWdoIHdhdGVyIG1hcmssIHdlIGNhbiBwdXNoIGluIHNvbWUgbW9yZS5cbi8vIEFsc28sIGlmIHdlIGhhdmUgbm8gZGF0YSB5ZXQsIHdlIGNhbiBzdGFuZCBzb21lXG4vLyBtb3JlIGJ5dGVzLiAgVGhpcyBpcyB0byB3b3JrIGFyb3VuZCBjYXNlcyB3aGVyZSBod209MCxcbi8vIHN1Y2ggYXMgdGhlIHJlcGwuICBBbHNvLCBpZiB0aGUgcHVzaCgpIHRyaWdnZXJlZCBhXG4vLyByZWFkYWJsZSBldmVudCwgYW5kIHRoZSB1c2VyIGNhbGxlZCByZWFkKGxhcmdlTnVtYmVyKSBzdWNoIHRoYXRcbi8vIG5lZWRSZWFkYWJsZSB3YXMgc2V0LCB0aGVuIHdlIG91Z2h0IHRvIHB1c2ggbW9yZSwgc28gdGhhdCBhbm90aGVyXG4vLyAncmVhZGFibGUnIGV2ZW50IHdpbGwgYmUgdHJpZ2dlcmVkLlxuZnVuY3Rpb24gbmVlZE1vcmVEYXRhKHN0YXRlKSB7XG4gIHJldHVybiAhc3RhdGUuZW5kZWQgJiZcbiAgICAgICAgIChzdGF0ZS5uZWVkUmVhZGFibGUgfHxcbiAgICAgICAgICBzdGF0ZS5sZW5ndGggPCBzdGF0ZS5oaWdoV2F0ZXJNYXJrIHx8XG4gICAgICAgICAgc3RhdGUubGVuZ3RoID09PSAwKTtcbn1cblxuLy8gYmFja3dhcmRzIGNvbXBhdGliaWxpdHkuXG5SZWFkYWJsZS5wcm90b3R5cGUuc2V0RW5jb2RpbmcgPSBmdW5jdGlvbihlbmMpIHtcbiAgaWYgKCFTdHJpbmdEZWNvZGVyKVxuICAgIFN0cmluZ0RlY29kZXIgPSByZXF1aXJlKCdzdHJpbmdfZGVjb2Rlci8nKS5TdHJpbmdEZWNvZGVyO1xuICB0aGlzLl9yZWFkYWJsZVN0YXRlLmRlY29kZXIgPSBuZXcgU3RyaW5nRGVjb2RlcihlbmMpO1xuICB0aGlzLl9yZWFkYWJsZVN0YXRlLmVuY29kaW5nID0gZW5jO1xuICByZXR1cm4gdGhpcztcbn07XG5cbi8vIERvbid0IHJhaXNlIHRoZSBod20gPiA4TUJcbnZhciBNQVhfSFdNID0gMHg4MDAwMDA7XG5mdW5jdGlvbiBjb21wdXRlTmV3SGlnaFdhdGVyTWFyayhuKSB7XG4gIGlmIChuID49IE1BWF9IV00pIHtcbiAgICBuID0gTUFYX0hXTTtcbiAgfSBlbHNlIHtcbiAgICAvLyBHZXQgdGhlIG5leHQgaGlnaGVzdCBwb3dlciBvZiAyXG4gICAgbi0tO1xuICAgIG4gfD0gbiA+Pj4gMTtcbiAgICBuIHw9IG4gPj4+IDI7XG4gICAgbiB8PSBuID4+PiA0O1xuICAgIG4gfD0gbiA+Pj4gODtcbiAgICBuIHw9IG4gPj4+IDE2O1xuICAgIG4rKztcbiAgfVxuICByZXR1cm4gbjtcbn1cblxuZnVuY3Rpb24gaG93TXVjaFRvUmVhZChuLCBzdGF0ZSkge1xuICBpZiAoc3RhdGUubGVuZ3RoID09PSAwICYmIHN0YXRlLmVuZGVkKVxuICAgIHJldHVybiAwO1xuXG4gIGlmIChzdGF0ZS5vYmplY3RNb2RlKVxuICAgIHJldHVybiBuID09PSAwID8gMCA6IDE7XG5cbiAgaWYgKG4gPT09IG51bGwgfHwgaXNOYU4obikpIHtcbiAgICAvLyBvbmx5IGZsb3cgb25lIGJ1ZmZlciBhdCBhIHRpbWVcbiAgICBpZiAoc3RhdGUuZmxvd2luZyAmJiBzdGF0ZS5idWZmZXIubGVuZ3RoKVxuICAgICAgcmV0dXJuIHN0YXRlLmJ1ZmZlclswXS5sZW5ndGg7XG4gICAgZWxzZVxuICAgICAgcmV0dXJuIHN0YXRlLmxlbmd0aDtcbiAgfVxuXG4gIGlmIChuIDw9IDApXG4gICAgcmV0dXJuIDA7XG5cbiAgLy8gSWYgd2UncmUgYXNraW5nIGZvciBtb3JlIHRoYW4gdGhlIHRhcmdldCBidWZmZXIgbGV2ZWwsXG4gIC8vIHRoZW4gcmFpc2UgdGhlIHdhdGVyIG1hcmsuICBCdW1wIHVwIHRvIHRoZSBuZXh0IGhpZ2hlc3RcbiAgLy8gcG93ZXIgb2YgMiwgdG8gcHJldmVudCBpbmNyZWFzaW5nIGl0IGV4Y2Vzc2l2ZWx5IGluIHRpbnlcbiAgLy8gYW1vdW50cy5cbiAgaWYgKG4gPiBzdGF0ZS5oaWdoV2F0ZXJNYXJrKVxuICAgIHN0YXRlLmhpZ2hXYXRlck1hcmsgPSBjb21wdXRlTmV3SGlnaFdhdGVyTWFyayhuKTtcblxuICAvLyBkb24ndCBoYXZlIHRoYXQgbXVjaC4gIHJldHVybiBudWxsLCB1bmxlc3Mgd2UndmUgZW5kZWQuXG4gIGlmIChuID4gc3RhdGUubGVuZ3RoKSB7XG4gICAgaWYgKCFzdGF0ZS5lbmRlZCkge1xuICAgICAgc3RhdGUubmVlZFJlYWRhYmxlID0gdHJ1ZTtcbiAgICAgIHJldHVybiAwO1xuICAgIH0gZWxzZSB7XG4gICAgICByZXR1cm4gc3RhdGUubGVuZ3RoO1xuICAgIH1cbiAgfVxuXG4gIHJldHVybiBuO1xufVxuXG4vLyB5b3UgY2FuIG92ZXJyaWRlIGVpdGhlciB0aGlzIG1ldGhvZCwgb3IgdGhlIGFzeW5jIF9yZWFkKG4pIGJlbG93LlxuUmVhZGFibGUucHJvdG90eXBlLnJlYWQgPSBmdW5jdGlvbihuKSB7XG4gIGRlYnVnKCdyZWFkJywgbik7XG4gIHZhciBzdGF0ZSA9IHRoaXMuX3JlYWRhYmxlU3RhdGU7XG4gIHZhciBuT3JpZyA9IG47XG5cbiAgaWYgKHR5cGVvZiBuICE9PSAnbnVtYmVyJyB8fCBuID4gMClcbiAgICBzdGF0ZS5lbWl0dGVkUmVhZGFibGUgPSBmYWxzZTtcblxuICAvLyBpZiB3ZSdyZSBkb2luZyByZWFkKDApIHRvIHRyaWdnZXIgYSByZWFkYWJsZSBldmVudCwgYnV0IHdlXG4gIC8vIGFscmVhZHkgaGF2ZSBhIGJ1bmNoIG9mIGRhdGEgaW4gdGhlIGJ1ZmZlciwgdGhlbiBqdXN0IHRyaWdnZXJcbiAgLy8gdGhlICdyZWFkYWJsZScgZXZlbnQgYW5kIG1vdmUgb24uXG4gIGlmIChuID09PSAwICYmXG4gICAgICBzdGF0ZS5uZWVkUmVhZGFibGUgJiZcbiAgICAgIChzdGF0ZS5sZW5ndGggPj0gc3RhdGUuaGlnaFdhdGVyTWFyayB8fCBzdGF0ZS5lbmRlZCkpIHtcbiAgICBkZWJ1ZygncmVhZDogZW1pdFJlYWRhYmxlJywgc3RhdGUubGVuZ3RoLCBzdGF0ZS5lbmRlZCk7XG4gICAgaWYgKHN0YXRlLmxlbmd0aCA9PT0gMCAmJiBzdGF0ZS5lbmRlZClcbiAgICAgIGVuZFJlYWRhYmxlKHRoaXMpO1xuICAgIGVsc2VcbiAgICAgIGVtaXRSZWFkYWJsZSh0aGlzKTtcbiAgICByZXR1cm4gbnVsbDtcbiAgfVxuXG4gIG4gPSBob3dNdWNoVG9SZWFkKG4sIHN0YXRlKTtcblxuICAvLyBpZiB3ZSd2ZSBlbmRlZCwgYW5kIHdlJ3JlIG5vdyBjbGVhciwgdGhlbiBmaW5pc2ggaXQgdXAuXG4gIGlmIChuID09PSAwICYmIHN0YXRlLmVuZGVkKSB7XG4gICAgaWYgKHN0YXRlLmxlbmd0aCA9PT0gMClcbiAgICAgIGVuZFJlYWRhYmxlKHRoaXMpO1xuICAgIHJldHVybiBudWxsO1xuICB9XG5cbiAgLy8gQWxsIHRoZSBhY3R1YWwgY2h1bmsgZ2VuZXJhdGlvbiBsb2dpYyBuZWVkcyB0byBiZVxuICAvLyAqYmVsb3cqIHRoZSBjYWxsIHRvIF9yZWFkLiAgVGhlIHJlYXNvbiBpcyB0aGF0IGluIGNlcnRhaW5cbiAgLy8gc3ludGhldGljIHN0cmVhbSBjYXNlcywgc3VjaCBhcyBwYXNzdGhyb3VnaCBzdHJlYW1zLCBfcmVhZFxuICAvLyBtYXkgYmUgYSBjb21wbGV0ZWx5IHN5bmNocm9ub3VzIG9wZXJhdGlvbiB3aGljaCBtYXkgY2hhbmdlXG4gIC8vIHRoZSBzdGF0ZSBvZiB0aGUgcmVhZCBidWZmZXIsIHByb3ZpZGluZyBlbm91Z2ggZGF0YSB3aGVuXG4gIC8vIGJlZm9yZSB0aGVyZSB3YXMgKm5vdCogZW5vdWdoLlxuICAvL1xuICAvLyBTbywgdGhlIHN0ZXBzIGFyZTpcbiAgLy8gMS4gRmlndXJlIG91dCB3aGF0IHRoZSBzdGF0ZSBvZiB0aGluZ3Mgd2lsbCBiZSBhZnRlciB3ZSBkb1xuICAvLyBhIHJlYWQgZnJvbSB0aGUgYnVmZmVyLlxuICAvL1xuICAvLyAyLiBJZiB0aGF0IHJlc3VsdGluZyBzdGF0ZSB3aWxsIHRyaWdnZXIgYSBfcmVhZCwgdGhlbiBjYWxsIF9yZWFkLlxuICAvLyBOb3RlIHRoYXQgdGhpcyBtYXkgYmUgYXN5bmNocm9ub3VzLCBvciBzeW5jaHJvbm91cy4gIFllcywgaXQgaXNcbiAgLy8gZGVlcGx5IHVnbHkgdG8gd3JpdGUgQVBJcyB0aGlzIHdheSwgYnV0IHRoYXQgc3RpbGwgZG9lc24ndCBtZWFuXG4gIC8vIHRoYXQgdGhlIFJlYWRhYmxlIGNsYXNzIHNob3VsZCBiZWhhdmUgaW1wcm9wZXJseSwgYXMgc3RyZWFtcyBhcmVcbiAgLy8gZGVzaWduZWQgdG8gYmUgc3luYy9hc3luYyBhZ25vc3RpYy5cbiAgLy8gVGFrZSBub3RlIGlmIHRoZSBfcmVhZCBjYWxsIGlzIHN5bmMgb3IgYXN5bmMgKGllLCBpZiB0aGUgcmVhZCBjYWxsXG4gIC8vIGhhcyByZXR1cm5lZCB5ZXQpLCBzbyB0aGF0IHdlIGtub3cgd2hldGhlciBvciBub3QgaXQncyBzYWZlIHRvIGVtaXRcbiAgLy8gJ3JlYWRhYmxlJyBldGMuXG4gIC8vXG4gIC8vIDMuIEFjdHVhbGx5IHB1bGwgdGhlIHJlcXVlc3RlZCBjaHVua3Mgb3V0IG9mIHRoZSBidWZmZXIgYW5kIHJldHVybi5cblxuICAvLyBpZiB3ZSBuZWVkIGEgcmVhZGFibGUgZXZlbnQsIHRoZW4gd2UgbmVlZCB0byBkbyBzb21lIHJlYWRpbmcuXG4gIHZhciBkb1JlYWQgPSBzdGF0ZS5uZWVkUmVhZGFibGU7XG4gIGRlYnVnKCduZWVkIHJlYWRhYmxlJywgZG9SZWFkKTtcblxuICAvLyBpZiB3ZSBjdXJyZW50bHkgaGF2ZSBsZXNzIHRoYW4gdGhlIGhpZ2hXYXRlck1hcmssIHRoZW4gYWxzbyByZWFkIHNvbWVcbiAgaWYgKHN0YXRlLmxlbmd0aCA9PT0gMCB8fCBzdGF0ZS5sZW5ndGggLSBuIDwgc3RhdGUuaGlnaFdhdGVyTWFyaykge1xuICAgIGRvUmVhZCA9IHRydWU7XG4gICAgZGVidWcoJ2xlbmd0aCBsZXNzIHRoYW4gd2F0ZXJtYXJrJywgZG9SZWFkKTtcbiAgfVxuXG4gIC8vIGhvd2V2ZXIsIGlmIHdlJ3ZlIGVuZGVkLCB0aGVuIHRoZXJlJ3Mgbm8gcG9pbnQsIGFuZCBpZiB3ZSdyZSBhbHJlYWR5XG4gIC8vIHJlYWRpbmcsIHRoZW4gaXQncyB1bm5lY2Vzc2FyeS5cbiAgaWYgKHN0YXRlLmVuZGVkIHx8IHN0YXRlLnJlYWRpbmcpIHtcbiAgICBkb1JlYWQgPSBmYWxzZTtcbiAgICBkZWJ1ZygncmVhZGluZyBvciBlbmRlZCcsIGRvUmVhZCk7XG4gIH1cblxuICBpZiAoZG9SZWFkKSB7XG4gICAgZGVidWcoJ2RvIHJlYWQnKTtcbiAgICBzdGF0ZS5yZWFkaW5nID0gdHJ1ZTtcbiAgICBzdGF0ZS5zeW5jID0gdHJ1ZTtcbiAgICAvLyBpZiB0aGUgbGVuZ3RoIGlzIGN1cnJlbnRseSB6ZXJvLCB0aGVuIHdlICpuZWVkKiBhIHJlYWRhYmxlIGV2ZW50LlxuICAgIGlmIChzdGF0ZS5sZW5ndGggPT09IDApXG4gICAgICBzdGF0ZS5uZWVkUmVhZGFibGUgPSB0cnVlO1xuICAgIC8vIGNhbGwgaW50ZXJuYWwgcmVhZCBtZXRob2RcbiAgICB0aGlzLl9yZWFkKHN0YXRlLmhpZ2hXYXRlck1hcmspO1xuICAgIHN0YXRlLnN5bmMgPSBmYWxzZTtcbiAgfVxuXG4gIC8vIElmIF9yZWFkIHB1c2hlZCBkYXRhIHN5bmNocm9ub3VzbHksIHRoZW4gYHJlYWRpbmdgIHdpbGwgYmUgZmFsc2UsXG4gIC8vIGFuZCB3ZSBuZWVkIHRvIHJlLWV2YWx1YXRlIGhvdyBtdWNoIGRhdGEgd2UgY2FuIHJldHVybiB0byB0aGUgdXNlci5cbiAgaWYgKGRvUmVhZCAmJiAhc3RhdGUucmVhZGluZylcbiAgICBuID0gaG93TXVjaFRvUmVhZChuT3JpZywgc3RhdGUpO1xuXG4gIHZhciByZXQ7XG4gIGlmIChuID4gMClcbiAgICByZXQgPSBmcm9tTGlzdChuLCBzdGF0ZSk7XG4gIGVsc2VcbiAgICByZXQgPSBudWxsO1xuXG4gIGlmIChyZXQgPT09IG51bGwpIHtcbiAgICBzdGF0ZS5uZWVkUmVhZGFibGUgPSB0cnVlO1xuICAgIG4gPSAwO1xuICB9XG5cbiAgc3RhdGUubGVuZ3RoIC09IG47XG5cbiAgLy8gSWYgd2UgaGF2ZSBub3RoaW5nIGluIHRoZSBidWZmZXIsIHRoZW4gd2Ugd2FudCB0byBrbm93XG4gIC8vIGFzIHNvb24gYXMgd2UgKmRvKiBnZXQgc29tZXRoaW5nIGludG8gdGhlIGJ1ZmZlci5cbiAgaWYgKHN0YXRlLmxlbmd0aCA9PT0gMCAmJiAhc3RhdGUuZW5kZWQpXG4gICAgc3RhdGUubmVlZFJlYWRhYmxlID0gdHJ1ZTtcblxuICAvLyBJZiB3ZSB0cmllZCB0byByZWFkKCkgcGFzdCB0aGUgRU9GLCB0aGVuIGVtaXQgZW5kIG9uIHRoZSBuZXh0IHRpY2suXG4gIGlmIChuT3JpZyAhPT0gbiAmJiBzdGF0ZS5lbmRlZCAmJiBzdGF0ZS5sZW5ndGggPT09IDApXG4gICAgZW5kUmVhZGFibGUodGhpcyk7XG5cbiAgaWYgKHJldCAhPT0gbnVsbClcbiAgICB0aGlzLmVtaXQoJ2RhdGEnLCByZXQpO1xuXG4gIHJldHVybiByZXQ7XG59O1xuXG5mdW5jdGlvbiBjaHVua0ludmFsaWQoc3RhdGUsIGNodW5rKSB7XG4gIHZhciBlciA9IG51bGw7XG4gIGlmICghKEJ1ZmZlci5pc0J1ZmZlcihjaHVuaykpICYmXG4gICAgICB0eXBlb2YgY2h1bmsgIT09ICdzdHJpbmcnICYmXG4gICAgICBjaHVuayAhPT0gbnVsbCAmJlxuICAgICAgY2h1bmsgIT09IHVuZGVmaW5lZCAmJlxuICAgICAgIXN0YXRlLm9iamVjdE1vZGUpIHtcbiAgICBlciA9IG5ldyBUeXBlRXJyb3IoJ0ludmFsaWQgbm9uLXN0cmluZy9idWZmZXIgY2h1bmsnKTtcbiAgfVxuICByZXR1cm4gZXI7XG59XG5cblxuZnVuY3Rpb24gb25Fb2ZDaHVuayhzdHJlYW0sIHN0YXRlKSB7XG4gIGlmIChzdGF0ZS5lbmRlZCkgcmV0dXJuO1xuICBpZiAoc3RhdGUuZGVjb2Rlcikge1xuICAgIHZhciBjaHVuayA9IHN0YXRlLmRlY29kZXIuZW5kKCk7XG4gICAgaWYgKGNodW5rICYmIGNodW5rLmxlbmd0aCkge1xuICAgICAgc3RhdGUuYnVmZmVyLnB1c2goY2h1bmspO1xuICAgICAgc3RhdGUubGVuZ3RoICs9IHN0YXRlLm9iamVjdE1vZGUgPyAxIDogY2h1bmsubGVuZ3RoO1xuICAgIH1cbiAgfVxuICBzdGF0ZS5lbmRlZCA9IHRydWU7XG5cbiAgLy8gZW1pdCAncmVhZGFibGUnIG5vdyB0byBtYWtlIHN1cmUgaXQgZ2V0cyBwaWNrZWQgdXAuXG4gIGVtaXRSZWFkYWJsZShzdHJlYW0pO1xufVxuXG4vLyBEb24ndCBlbWl0IHJlYWRhYmxlIHJpZ2h0IGF3YXkgaW4gc3luYyBtb2RlLCBiZWNhdXNlIHRoaXMgY2FuIHRyaWdnZXJcbi8vIGFub3RoZXIgcmVhZCgpIGNhbGwgPT4gc3RhY2sgb3ZlcmZsb3cuICBUaGlzIHdheSwgaXQgbWlnaHQgdHJpZ2dlclxuLy8gYSBuZXh0VGljayByZWN1cnNpb24gd2FybmluZywgYnV0IHRoYXQncyBub3Qgc28gYmFkLlxuZnVuY3Rpb24gZW1pdFJlYWRhYmxlKHN0cmVhbSkge1xuICB2YXIgc3RhdGUgPSBzdHJlYW0uX3JlYWRhYmxlU3RhdGU7XG4gIHN0YXRlLm5lZWRSZWFkYWJsZSA9IGZhbHNlO1xuICBpZiAoIXN0YXRlLmVtaXR0ZWRSZWFkYWJsZSkge1xuICAgIGRlYnVnKCdlbWl0UmVhZGFibGUnLCBzdGF0ZS5mbG93aW5nKTtcbiAgICBzdGF0ZS5lbWl0dGVkUmVhZGFibGUgPSB0cnVlO1xuICAgIGlmIChzdGF0ZS5zeW5jKVxuICAgICAgcHJvY2Vzc05leHRUaWNrKGVtaXRSZWFkYWJsZV8sIHN0cmVhbSk7XG4gICAgZWxzZVxuICAgICAgZW1pdFJlYWRhYmxlXyhzdHJlYW0pO1xuICB9XG59XG5cbmZ1bmN0aW9uIGVtaXRSZWFkYWJsZV8oc3RyZWFtKSB7XG4gIGRlYnVnKCdlbWl0IHJlYWRhYmxlJyk7XG4gIHN0cmVhbS5lbWl0KCdyZWFkYWJsZScpO1xuICBmbG93KHN0cmVhbSk7XG59XG5cblxuLy8gYXQgdGhpcyBwb2ludCwgdGhlIHVzZXIgaGFzIHByZXN1bWFibHkgc2VlbiB0aGUgJ3JlYWRhYmxlJyBldmVudCxcbi8vIGFuZCBjYWxsZWQgcmVhZCgpIHRvIGNvbnN1bWUgc29tZSBkYXRhLiAgdGhhdCBtYXkgaGF2ZSB0cmlnZ2VyZWRcbi8vIGluIHR1cm4gYW5vdGhlciBfcmVhZChuKSBjYWxsLCBpbiB3aGljaCBjYXNlIHJlYWRpbmcgPSB0cnVlIGlmXG4vLyBpdCdzIGluIHByb2dyZXNzLlxuLy8gSG93ZXZlciwgaWYgd2UncmUgbm90IGVuZGVkLCBvciByZWFkaW5nLCBhbmQgdGhlIGxlbmd0aCA8IGh3bSxcbi8vIHRoZW4gZ28gYWhlYWQgYW5kIHRyeSB0byByZWFkIHNvbWUgbW9yZSBwcmVlbXB0aXZlbHkuXG5mdW5jdGlvbiBtYXliZVJlYWRNb3JlKHN0cmVhbSwgc3RhdGUpIHtcbiAgaWYgKCFzdGF0ZS5yZWFkaW5nTW9yZSkge1xuICAgIHN0YXRlLnJlYWRpbmdNb3JlID0gdHJ1ZTtcbiAgICBwcm9jZXNzTmV4dFRpY2sobWF5YmVSZWFkTW9yZV8sIHN0cmVhbSwgc3RhdGUpO1xuICB9XG59XG5cbmZ1bmN0aW9uIG1heWJlUmVhZE1vcmVfKHN0cmVhbSwgc3RhdGUpIHtcbiAgdmFyIGxlbiA9IHN0YXRlLmxlbmd0aDtcbiAgd2hpbGUgKCFzdGF0ZS5yZWFkaW5nICYmICFzdGF0ZS5mbG93aW5nICYmICFzdGF0ZS5lbmRlZCAmJlxuICAgICAgICAgc3RhdGUubGVuZ3RoIDwgc3RhdGUuaGlnaFdhdGVyTWFyaykge1xuICAgIGRlYnVnKCdtYXliZVJlYWRNb3JlIHJlYWQgMCcpO1xuICAgIHN0cmVhbS5yZWFkKDApO1xuICAgIGlmIChsZW4gPT09IHN0YXRlLmxlbmd0aClcbiAgICAgIC8vIGRpZG4ndCBnZXQgYW55IGRhdGEsIHN0b3Agc3Bpbm5pbmcuXG4gICAgICBicmVhaztcbiAgICBlbHNlXG4gICAgICBsZW4gPSBzdGF0ZS5sZW5ndGg7XG4gIH1cbiAgc3RhdGUucmVhZGluZ01vcmUgPSBmYWxzZTtcbn1cblxuLy8gYWJzdHJhY3QgbWV0aG9kLiAgdG8gYmUgb3ZlcnJpZGRlbiBpbiBzcGVjaWZpYyBpbXBsZW1lbnRhdGlvbiBjbGFzc2VzLlxuLy8gY2FsbCBjYihlciwgZGF0YSkgd2hlcmUgZGF0YSBpcyA8PSBuIGluIGxlbmd0aC5cbi8vIGZvciB2aXJ0dWFsIChub24tc3RyaW5nLCBub24tYnVmZmVyKSBzdHJlYW1zLCBcImxlbmd0aFwiIGlzIHNvbWV3aGF0XG4vLyBhcmJpdHJhcnksIGFuZCBwZXJoYXBzIG5vdCB2ZXJ5IG1lYW5pbmdmdWwuXG5SZWFkYWJsZS5wcm90b3R5cGUuX3JlYWQgPSBmdW5jdGlvbihuKSB7XG4gIHRoaXMuZW1pdCgnZXJyb3InLCBuZXcgRXJyb3IoJ25vdCBpbXBsZW1lbnRlZCcpKTtcbn07XG5cblJlYWRhYmxlLnByb3RvdHlwZS5waXBlID0gZnVuY3Rpb24oZGVzdCwgcGlwZU9wdHMpIHtcbiAgdmFyIHNyYyA9IHRoaXM7XG4gIHZhciBzdGF0ZSA9IHRoaXMuX3JlYWRhYmxlU3RhdGU7XG5cbiAgc3dpdGNoIChzdGF0ZS5waXBlc0NvdW50KSB7XG4gICAgY2FzZSAwOlxuICAgICAgc3RhdGUucGlwZXMgPSBkZXN0O1xuICAgICAgYnJlYWs7XG4gICAgY2FzZSAxOlxuICAgICAgc3RhdGUucGlwZXMgPSBbc3RhdGUucGlwZXMsIGRlc3RdO1xuICAgICAgYnJlYWs7XG4gICAgZGVmYXVsdDpcbiAgICAgIHN0YXRlLnBpcGVzLnB1c2goZGVzdCk7XG4gICAgICBicmVhaztcbiAgfVxuICBzdGF0ZS5waXBlc0NvdW50ICs9IDE7XG4gIGRlYnVnKCdwaXBlIGNvdW50PSVkIG9wdHM9JWonLCBzdGF0ZS5waXBlc0NvdW50LCBwaXBlT3B0cyk7XG5cbiAgdmFyIGRvRW5kID0gKCFwaXBlT3B0cyB8fCBwaXBlT3B0cy5lbmQgIT09IGZhbHNlKSAmJlxuICAgICAgICAgICAgICBkZXN0ICE9PSBwcm9jZXNzLnN0ZG91dCAmJlxuICAgICAgICAgICAgICBkZXN0ICE9PSBwcm9jZXNzLnN0ZGVycjtcblxuICB2YXIgZW5kRm4gPSBkb0VuZCA/IG9uZW5kIDogY2xlYW51cDtcbiAgaWYgKHN0YXRlLmVuZEVtaXR0ZWQpXG4gICAgcHJvY2Vzc05leHRUaWNrKGVuZEZuKTtcbiAgZWxzZVxuICAgIHNyYy5vbmNlKCdlbmQnLCBlbmRGbik7XG5cbiAgZGVzdC5vbigndW5waXBlJywgb251bnBpcGUpO1xuICBmdW5jdGlvbiBvbnVucGlwZShyZWFkYWJsZSkge1xuICAgIGRlYnVnKCdvbnVucGlwZScpO1xuICAgIGlmIChyZWFkYWJsZSA9PT0gc3JjKSB7XG4gICAgICBjbGVhbnVwKCk7XG4gICAgfVxuICB9XG5cbiAgZnVuY3Rpb24gb25lbmQoKSB7XG4gICAgZGVidWcoJ29uZW5kJyk7XG4gICAgZGVzdC5lbmQoKTtcbiAgfVxuXG4gIC8vIHdoZW4gdGhlIGRlc3QgZHJhaW5zLCBpdCByZWR1Y2VzIHRoZSBhd2FpdERyYWluIGNvdW50ZXJcbiAgLy8gb24gdGhlIHNvdXJjZS4gIFRoaXMgd291bGQgYmUgbW9yZSBlbGVnYW50IHdpdGggYSAub25jZSgpXG4gIC8vIGhhbmRsZXIgaW4gZmxvdygpLCBidXQgYWRkaW5nIGFuZCByZW1vdmluZyByZXBlYXRlZGx5IGlzXG4gIC8vIHRvbyBzbG93LlxuICB2YXIgb25kcmFpbiA9IHBpcGVPbkRyYWluKHNyYyk7XG4gIGRlc3Qub24oJ2RyYWluJywgb25kcmFpbik7XG5cbiAgdmFyIGNsZWFuZWRVcCA9IGZhbHNlO1xuICBmdW5jdGlvbiBjbGVhbnVwKCkge1xuICAgIGRlYnVnKCdjbGVhbnVwJyk7XG4gICAgLy8gY2xlYW51cCBldmVudCBoYW5kbGVycyBvbmNlIHRoZSBwaXBlIGlzIGJyb2tlblxuICAgIGRlc3QucmVtb3ZlTGlzdGVuZXIoJ2Nsb3NlJywgb25jbG9zZSk7XG4gICAgZGVzdC5yZW1vdmVMaXN0ZW5lcignZmluaXNoJywgb25maW5pc2gpO1xuICAgIGRlc3QucmVtb3ZlTGlzdGVuZXIoJ2RyYWluJywgb25kcmFpbik7XG4gICAgZGVzdC5yZW1vdmVMaXN0ZW5lcignZXJyb3InLCBvbmVycm9yKTtcbiAgICBkZXN0LnJlbW92ZUxpc3RlbmVyKCd1bnBpcGUnLCBvbnVucGlwZSk7XG4gICAgc3JjLnJlbW92ZUxpc3RlbmVyKCdlbmQnLCBvbmVuZCk7XG4gICAgc3JjLnJlbW92ZUxpc3RlbmVyKCdlbmQnLCBjbGVhbnVwKTtcbiAgICBzcmMucmVtb3ZlTGlzdGVuZXIoJ2RhdGEnLCBvbmRhdGEpO1xuXG4gICAgY2xlYW5lZFVwID0gdHJ1ZTtcblxuICAgIC8vIGlmIHRoZSByZWFkZXIgaXMgd2FpdGluZyBmb3IgYSBkcmFpbiBldmVudCBmcm9tIHRoaXNcbiAgICAvLyBzcGVjaWZpYyB3cml0ZXIsIHRoZW4gaXQgd291bGQgY2F1c2UgaXQgdG8gbmV2ZXIgc3RhcnRcbiAgICAvLyBmbG93aW5nIGFnYWluLlxuICAgIC8vIFNvLCBpZiB0aGlzIGlzIGF3YWl0aW5nIGEgZHJhaW4sIHRoZW4gd2UganVzdCBjYWxsIGl0IG5vdy5cbiAgICAvLyBJZiB3ZSBkb24ndCBrbm93LCB0aGVuIGFzc3VtZSB0aGF0IHdlIGFyZSB3YWl0aW5nIGZvciBvbmUuXG4gICAgaWYgKHN0YXRlLmF3YWl0RHJhaW4gJiZcbiAgICAgICAgKCFkZXN0Ll93cml0YWJsZVN0YXRlIHx8IGRlc3QuX3dyaXRhYmxlU3RhdGUubmVlZERyYWluKSlcbiAgICAgIG9uZHJhaW4oKTtcbiAgfVxuXG4gIHNyYy5vbignZGF0YScsIG9uZGF0YSk7XG4gIGZ1bmN0aW9uIG9uZGF0YShjaHVuaykge1xuICAgIGRlYnVnKCdvbmRhdGEnKTtcbiAgICB2YXIgcmV0ID0gZGVzdC53cml0ZShjaHVuayk7XG4gICAgaWYgKGZhbHNlID09PSByZXQpIHtcbiAgICAgIC8vIElmIHRoZSB1c2VyIHVucGlwZWQgZHVyaW5nIGBkZXN0LndyaXRlKClgLCBpdCBpcyBwb3NzaWJsZVxuICAgICAgLy8gdG8gZ2V0IHN0dWNrIGluIGEgcGVybWFuZW50bHkgcGF1c2VkIHN0YXRlIGlmIHRoYXQgd3JpdGVcbiAgICAgIC8vIGFsc28gcmV0dXJuZWQgZmFsc2UuXG4gICAgICBpZiAoc3RhdGUucGlwZXNDb3VudCA9PT0gMSAmJlxuICAgICAgICAgIHN0YXRlLnBpcGVzWzBdID09PSBkZXN0ICYmXG4gICAgICAgICAgc3JjLmxpc3RlbmVyQ291bnQoJ2RhdGEnKSA9PT0gMSAmJlxuICAgICAgICAgICFjbGVhbmVkVXApIHtcbiAgICAgICAgZGVidWcoJ2ZhbHNlIHdyaXRlIHJlc3BvbnNlLCBwYXVzZScsIHNyYy5fcmVhZGFibGVTdGF0ZS5hd2FpdERyYWluKTtcbiAgICAgICAgc3JjLl9yZWFkYWJsZVN0YXRlLmF3YWl0RHJhaW4rKztcbiAgICAgIH1cbiAgICAgIHNyYy5wYXVzZSgpO1xuICAgIH1cbiAgfVxuXG4gIC8vIGlmIHRoZSBkZXN0IGhhcyBhbiBlcnJvciwgdGhlbiBzdG9wIHBpcGluZyBpbnRvIGl0LlxuICAvLyBob3dldmVyLCBkb24ndCBzdXBwcmVzcyB0aGUgdGhyb3dpbmcgYmVoYXZpb3IgZm9yIHRoaXMuXG4gIGZ1bmN0aW9uIG9uZXJyb3IoZXIpIHtcbiAgICBkZWJ1Zygnb25lcnJvcicsIGVyKTtcbiAgICB1bnBpcGUoKTtcbiAgICBkZXN0LnJlbW92ZUxpc3RlbmVyKCdlcnJvcicsIG9uZXJyb3IpO1xuICAgIGlmIChFRWxpc3RlbmVyQ291bnQoZGVzdCwgJ2Vycm9yJykgPT09IDApXG4gICAgICBkZXN0LmVtaXQoJ2Vycm9yJywgZXIpO1xuICB9XG4gIC8vIFRoaXMgaXMgYSBicnV0YWxseSB1Z2x5IGhhY2sgdG8gbWFrZSBzdXJlIHRoYXQgb3VyIGVycm9yIGhhbmRsZXJcbiAgLy8gaXMgYXR0YWNoZWQgYmVmb3JlIGFueSB1c2VybGFuZCBvbmVzLiAgTkVWRVIgRE8gVEhJUy5cbiAgaWYgKCFkZXN0Ll9ldmVudHMgfHwgIWRlc3QuX2V2ZW50cy5lcnJvcilcbiAgICBkZXN0Lm9uKCdlcnJvcicsIG9uZXJyb3IpO1xuICBlbHNlIGlmIChpc0FycmF5KGRlc3QuX2V2ZW50cy5lcnJvcikpXG4gICAgZGVzdC5fZXZlbnRzLmVycm9yLnVuc2hpZnQob25lcnJvcik7XG4gIGVsc2VcbiAgICBkZXN0Ll9ldmVudHMuZXJyb3IgPSBbb25lcnJvciwgZGVzdC5fZXZlbnRzLmVycm9yXTtcblxuXG4gIC8vIEJvdGggY2xvc2UgYW5kIGZpbmlzaCBzaG91bGQgdHJpZ2dlciB1bnBpcGUsIGJ1dCBvbmx5IG9uY2UuXG4gIGZ1bmN0aW9uIG9uY2xvc2UoKSB7XG4gICAgZGVzdC5yZW1vdmVMaXN0ZW5lcignZmluaXNoJywgb25maW5pc2gpO1xuICAgIHVucGlwZSgpO1xuICB9XG4gIGRlc3Qub25jZSgnY2xvc2UnLCBvbmNsb3NlKTtcbiAgZnVuY3Rpb24gb25maW5pc2goKSB7XG4gICAgZGVidWcoJ29uZmluaXNoJyk7XG4gICAgZGVzdC5yZW1vdmVMaXN0ZW5lcignY2xvc2UnLCBvbmNsb3NlKTtcbiAgICB1bnBpcGUoKTtcbiAgfVxuICBkZXN0Lm9uY2UoJ2ZpbmlzaCcsIG9uZmluaXNoKTtcblxuICBmdW5jdGlvbiB1bnBpcGUoKSB7XG4gICAgZGVidWcoJ3VucGlwZScpO1xuICAgIHNyYy51bnBpcGUoZGVzdCk7XG4gIH1cblxuICAvLyB0ZWxsIHRoZSBkZXN0IHRoYXQgaXQncyBiZWluZyBwaXBlZCB0b1xuICBkZXN0LmVtaXQoJ3BpcGUnLCBzcmMpO1xuXG4gIC8vIHN0YXJ0IHRoZSBmbG93IGlmIGl0IGhhc24ndCBiZWVuIHN0YXJ0ZWQgYWxyZWFkeS5cbiAgaWYgKCFzdGF0ZS5mbG93aW5nKSB7XG4gICAgZGVidWcoJ3BpcGUgcmVzdW1lJyk7XG4gICAgc3JjLnJlc3VtZSgpO1xuICB9XG5cbiAgcmV0dXJuIGRlc3Q7XG59O1xuXG5mdW5jdGlvbiBwaXBlT25EcmFpbihzcmMpIHtcbiAgcmV0dXJuIGZ1bmN0aW9uKCkge1xuICAgIHZhciBzdGF0ZSA9IHNyYy5fcmVhZGFibGVTdGF0ZTtcbiAgICBkZWJ1ZygncGlwZU9uRHJhaW4nLCBzdGF0ZS5hd2FpdERyYWluKTtcbiAgICBpZiAoc3RhdGUuYXdhaXREcmFpbilcbiAgICAgIHN0YXRlLmF3YWl0RHJhaW4tLTtcbiAgICBpZiAoc3RhdGUuYXdhaXREcmFpbiA9PT0gMCAmJiBFRWxpc3RlbmVyQ291bnQoc3JjLCAnZGF0YScpKSB7XG4gICAgICBzdGF0ZS5mbG93aW5nID0gdHJ1ZTtcbiAgICAgIGZsb3coc3JjKTtcbiAgICB9XG4gIH07XG59XG5cblxuUmVhZGFibGUucHJvdG90eXBlLnVucGlwZSA9IGZ1bmN0aW9uKGRlc3QpIHtcbiAgdmFyIHN0YXRlID0gdGhpcy5fcmVhZGFibGVTdGF0ZTtcblxuICAvLyBpZiB3ZSdyZSBub3QgcGlwaW5nIGFueXdoZXJlLCB0aGVuIGRvIG5vdGhpbmcuXG4gIGlmIChzdGF0ZS5waXBlc0NvdW50ID09PSAwKVxuICAgIHJldHVybiB0aGlzO1xuXG4gIC8vIGp1c3Qgb25lIGRlc3RpbmF0aW9uLiAgbW9zdCBjb21tb24gY2FzZS5cbiAgaWYgKHN0YXRlLnBpcGVzQ291bnQgPT09IDEpIHtcbiAgICAvLyBwYXNzZWQgaW4gb25lLCBidXQgaXQncyBub3QgdGhlIHJpZ2h0IG9uZS5cbiAgICBpZiAoZGVzdCAmJiBkZXN0ICE9PSBzdGF0ZS5waXBlcylcbiAgICAgIHJldHVybiB0aGlzO1xuXG4gICAgaWYgKCFkZXN0KVxuICAgICAgZGVzdCA9IHN0YXRlLnBpcGVzO1xuXG4gICAgLy8gZ290IGEgbWF0Y2guXG4gICAgc3RhdGUucGlwZXMgPSBudWxsO1xuICAgIHN0YXRlLnBpcGVzQ291bnQgPSAwO1xuICAgIHN0YXRlLmZsb3dpbmcgPSBmYWxzZTtcbiAgICBpZiAoZGVzdClcbiAgICAgIGRlc3QuZW1pdCgndW5waXBlJywgdGhpcyk7XG4gICAgcmV0dXJuIHRoaXM7XG4gIH1cblxuICAvLyBzbG93IGNhc2UuIG11bHRpcGxlIHBpcGUgZGVzdGluYXRpb25zLlxuXG4gIGlmICghZGVzdCkge1xuICAgIC8vIHJlbW92ZSBhbGwuXG4gICAgdmFyIGRlc3RzID0gc3RhdGUucGlwZXM7XG4gICAgdmFyIGxlbiA9IHN0YXRlLnBpcGVzQ291bnQ7XG4gICAgc3RhdGUucGlwZXMgPSBudWxsO1xuICAgIHN0YXRlLnBpcGVzQ291bnQgPSAwO1xuICAgIHN0YXRlLmZsb3dpbmcgPSBmYWxzZTtcblxuICAgIGZvciAodmFyIGkgPSAwOyBpIDwgbGVuOyBpKyspXG4gICAgICBkZXN0c1tpXS5lbWl0KCd1bnBpcGUnLCB0aGlzKTtcbiAgICByZXR1cm4gdGhpcztcbiAgfVxuXG4gIC8vIHRyeSB0byBmaW5kIHRoZSByaWdodCBvbmUuXG4gIHZhciBpID0gaW5kZXhPZihzdGF0ZS5waXBlcywgZGVzdCk7XG4gIGlmIChpID09PSAtMSlcbiAgICByZXR1cm4gdGhpcztcblxuICBzdGF0ZS5waXBlcy5zcGxpY2UoaSwgMSk7XG4gIHN0YXRlLnBpcGVzQ291bnQgLT0gMTtcbiAgaWYgKHN0YXRlLnBpcGVzQ291bnQgPT09IDEpXG4gICAgc3RhdGUucGlwZXMgPSBzdGF0ZS5waXBlc1swXTtcblxuICBkZXN0LmVtaXQoJ3VucGlwZScsIHRoaXMpO1xuXG4gIHJldHVybiB0aGlzO1xufTtcblxuLy8gc2V0IHVwIGRhdGEgZXZlbnRzIGlmIHRoZXkgYXJlIGFza2VkIGZvclxuLy8gRW5zdXJlIHJlYWRhYmxlIGxpc3RlbmVycyBldmVudHVhbGx5IGdldCBzb21ldGhpbmdcblJlYWRhYmxlLnByb3RvdHlwZS5vbiA9IGZ1bmN0aW9uKGV2LCBmbikge1xuICB2YXIgcmVzID0gU3RyZWFtLnByb3RvdHlwZS5vbi5jYWxsKHRoaXMsIGV2LCBmbik7XG5cbiAgLy8gSWYgbGlzdGVuaW5nIHRvIGRhdGEsIGFuZCBpdCBoYXMgbm90IGV4cGxpY2l0bHkgYmVlbiBwYXVzZWQsXG4gIC8vIHRoZW4gY2FsbCByZXN1bWUgdG8gc3RhcnQgdGhlIGZsb3cgb2YgZGF0YSBvbiB0aGUgbmV4dCB0aWNrLlxuICBpZiAoZXYgPT09ICdkYXRhJyAmJiBmYWxzZSAhPT0gdGhpcy5fcmVhZGFibGVTdGF0ZS5mbG93aW5nKSB7XG4gICAgdGhpcy5yZXN1bWUoKTtcbiAgfVxuXG4gIGlmIChldiA9PT0gJ3JlYWRhYmxlJyAmJiB0aGlzLnJlYWRhYmxlKSB7XG4gICAgdmFyIHN0YXRlID0gdGhpcy5fcmVhZGFibGVTdGF0ZTtcbiAgICBpZiAoIXN0YXRlLnJlYWRhYmxlTGlzdGVuaW5nKSB7XG4gICAgICBzdGF0ZS5yZWFkYWJsZUxpc3RlbmluZyA9IHRydWU7XG4gICAgICBzdGF0ZS5lbWl0dGVkUmVhZGFibGUgPSBmYWxzZTtcbiAgICAgIHN0YXRlLm5lZWRSZWFkYWJsZSA9IHRydWU7XG4gICAgICBpZiAoIXN0YXRlLnJlYWRpbmcpIHtcbiAgICAgICAgcHJvY2Vzc05leHRUaWNrKG5SZWFkaW5nTmV4dFRpY2ssIHRoaXMpO1xuICAgICAgfSBlbHNlIGlmIChzdGF0ZS5sZW5ndGgpIHtcbiAgICAgICAgZW1pdFJlYWRhYmxlKHRoaXMsIHN0YXRlKTtcbiAgICAgIH1cbiAgICB9XG4gIH1cblxuICByZXR1cm4gcmVzO1xufTtcblJlYWRhYmxlLnByb3RvdHlwZS5hZGRMaXN0ZW5lciA9IFJlYWRhYmxlLnByb3RvdHlwZS5vbjtcblxuZnVuY3Rpb24gblJlYWRpbmdOZXh0VGljayhzZWxmKSB7XG4gIGRlYnVnKCdyZWFkYWJsZSBuZXh0dGljayByZWFkIDAnKTtcbiAgc2VsZi5yZWFkKDApO1xufVxuXG4vLyBwYXVzZSgpIGFuZCByZXN1bWUoKSBhcmUgcmVtbmFudHMgb2YgdGhlIGxlZ2FjeSByZWFkYWJsZSBzdHJlYW0gQVBJXG4vLyBJZiB0aGUgdXNlciB1c2VzIHRoZW0sIHRoZW4gc3dpdGNoIGludG8gb2xkIG1vZGUuXG5SZWFkYWJsZS5wcm90b3R5cGUucmVzdW1lID0gZnVuY3Rpb24oKSB7XG4gIHZhciBzdGF0ZSA9IHRoaXMuX3JlYWRhYmxlU3RhdGU7XG4gIGlmICghc3RhdGUuZmxvd2luZykge1xuICAgIGRlYnVnKCdyZXN1bWUnKTtcbiAgICBzdGF0ZS5mbG93aW5nID0gdHJ1ZTtcbiAgICByZXN1bWUodGhpcywgc3RhdGUpO1xuICB9XG4gIHJldHVybiB0aGlzO1xufTtcblxuZnVuY3Rpb24gcmVzdW1lKHN0cmVhbSwgc3RhdGUpIHtcbiAgaWYgKCFzdGF0ZS5yZXN1bWVTY2hlZHVsZWQpIHtcbiAgICBzdGF0ZS5yZXN1bWVTY2hlZHVsZWQgPSB0cnVlO1xuICAgIHByb2Nlc3NOZXh0VGljayhyZXN1bWVfLCBzdHJlYW0sIHN0YXRlKTtcbiAgfVxufVxuXG5mdW5jdGlvbiByZXN1bWVfKHN0cmVhbSwgc3RhdGUpIHtcbiAgaWYgKCFzdGF0ZS5yZWFkaW5nKSB7XG4gICAgZGVidWcoJ3Jlc3VtZSByZWFkIDAnKTtcbiAgICBzdHJlYW0ucmVhZCgwKTtcbiAgfVxuXG4gIHN0YXRlLnJlc3VtZVNjaGVkdWxlZCA9IGZhbHNlO1xuICBzdHJlYW0uZW1pdCgncmVzdW1lJyk7XG4gIGZsb3coc3RyZWFtKTtcbiAgaWYgKHN0YXRlLmZsb3dpbmcgJiYgIXN0YXRlLnJlYWRpbmcpXG4gICAgc3RyZWFtLnJlYWQoMCk7XG59XG5cblJlYWRhYmxlLnByb3RvdHlwZS5wYXVzZSA9IGZ1bmN0aW9uKCkge1xuICBkZWJ1ZygnY2FsbCBwYXVzZSBmbG93aW5nPSVqJywgdGhpcy5fcmVhZGFibGVTdGF0ZS5mbG93aW5nKTtcbiAgaWYgKGZhbHNlICE9PSB0aGlzLl9yZWFkYWJsZVN0YXRlLmZsb3dpbmcpIHtcbiAgICBkZWJ1ZygncGF1c2UnKTtcbiAgICB0aGlzLl9yZWFkYWJsZVN0YXRlLmZsb3dpbmcgPSBmYWxzZTtcbiAgICB0aGlzLmVtaXQoJ3BhdXNlJyk7XG4gIH1cbiAgcmV0dXJuIHRoaXM7XG59O1xuXG5mdW5jdGlvbiBmbG93KHN0cmVhbSkge1xuICB2YXIgc3RhdGUgPSBzdHJlYW0uX3JlYWRhYmxlU3RhdGU7XG4gIGRlYnVnKCdmbG93Jywgc3RhdGUuZmxvd2luZyk7XG4gIGlmIChzdGF0ZS5mbG93aW5nKSB7XG4gICAgZG8ge1xuICAgICAgdmFyIGNodW5rID0gc3RyZWFtLnJlYWQoKTtcbiAgICB9IHdoaWxlIChudWxsICE9PSBjaHVuayAmJiBzdGF0ZS5mbG93aW5nKTtcbiAgfVxufVxuXG4vLyB3cmFwIGFuIG9sZC1zdHlsZSBzdHJlYW0gYXMgdGhlIGFzeW5jIGRhdGEgc291cmNlLlxuLy8gVGhpcyBpcyAqbm90KiBwYXJ0IG9mIHRoZSByZWFkYWJsZSBzdHJlYW0gaW50ZXJmYWNlLlxuLy8gSXQgaXMgYW4gdWdseSB1bmZvcnR1bmF0ZSBtZXNzIG9mIGhpc3RvcnkuXG5SZWFkYWJsZS5wcm90b3R5cGUud3JhcCA9IGZ1bmN0aW9uKHN0cmVhbSkge1xuICB2YXIgc3RhdGUgPSB0aGlzLl9yZWFkYWJsZVN0YXRlO1xuICB2YXIgcGF1c2VkID0gZmFsc2U7XG5cbiAgdmFyIHNlbGYgPSB0aGlzO1xuICBzdHJlYW0ub24oJ2VuZCcsIGZ1bmN0aW9uKCkge1xuICAgIGRlYnVnKCd3cmFwcGVkIGVuZCcpO1xuICAgIGlmIChzdGF0ZS5kZWNvZGVyICYmICFzdGF0ZS5lbmRlZCkge1xuICAgICAgdmFyIGNodW5rID0gc3RhdGUuZGVjb2Rlci5lbmQoKTtcbiAgICAgIGlmIChjaHVuayAmJiBjaHVuay5sZW5ndGgpXG4gICAgICAgIHNlbGYucHVzaChjaHVuayk7XG4gICAgfVxuXG4gICAgc2VsZi5wdXNoKG51bGwpO1xuICB9KTtcblxuICBzdHJlYW0ub24oJ2RhdGEnLCBmdW5jdGlvbihjaHVuaykge1xuICAgIGRlYnVnKCd3cmFwcGVkIGRhdGEnKTtcbiAgICBpZiAoc3RhdGUuZGVjb2RlcilcbiAgICAgIGNodW5rID0gc3RhdGUuZGVjb2Rlci53cml0ZShjaHVuayk7XG5cbiAgICAvLyBkb24ndCBza2lwIG92ZXIgZmFsc3kgdmFsdWVzIGluIG9iamVjdE1vZGVcbiAgICBpZiAoc3RhdGUub2JqZWN0TW9kZSAmJiAoY2h1bmsgPT09IG51bGwgfHwgY2h1bmsgPT09IHVuZGVmaW5lZCkpXG4gICAgICByZXR1cm47XG4gICAgZWxzZSBpZiAoIXN0YXRlLm9iamVjdE1vZGUgJiYgKCFjaHVuayB8fCAhY2h1bmsubGVuZ3RoKSlcbiAgICAgIHJldHVybjtcblxuICAgIHZhciByZXQgPSBzZWxmLnB1c2goY2h1bmspO1xuICAgIGlmICghcmV0KSB7XG4gICAgICBwYXVzZWQgPSB0cnVlO1xuICAgICAgc3RyZWFtLnBhdXNlKCk7XG4gICAgfVxuICB9KTtcblxuICAvLyBwcm94eSBhbGwgdGhlIG90aGVyIG1ldGhvZHMuXG4gIC8vIGltcG9ydGFudCB3aGVuIHdyYXBwaW5nIGZpbHRlcnMgYW5kIGR1cGxleGVzLlxuICBmb3IgKHZhciBpIGluIHN0cmVhbSkge1xuICAgIGlmICh0aGlzW2ldID09PSB1bmRlZmluZWQgJiYgdHlwZW9mIHN0cmVhbVtpXSA9PT0gJ2Z1bmN0aW9uJykge1xuICAgICAgdGhpc1tpXSA9IGZ1bmN0aW9uKG1ldGhvZCkgeyByZXR1cm4gZnVuY3Rpb24oKSB7XG4gICAgICAgIHJldHVybiBzdHJlYW1bbWV0aG9kXS5hcHBseShzdHJlYW0sIGFyZ3VtZW50cyk7XG4gICAgICB9OyB9KGkpO1xuICAgIH1cbiAgfVxuXG4gIC8vIHByb3h5IGNlcnRhaW4gaW1wb3J0YW50IGV2ZW50cy5cbiAgdmFyIGV2ZW50cyA9IFsnZXJyb3InLCAnY2xvc2UnLCAnZGVzdHJveScsICdwYXVzZScsICdyZXN1bWUnXTtcbiAgZm9yRWFjaChldmVudHMsIGZ1bmN0aW9uKGV2KSB7XG4gICAgc3RyZWFtLm9uKGV2LCBzZWxmLmVtaXQuYmluZChzZWxmLCBldikpO1xuICB9KTtcblxuICAvLyB3aGVuIHdlIHRyeSB0byBjb25zdW1lIHNvbWUgbW9yZSBieXRlcywgc2ltcGx5IHVucGF1c2UgdGhlXG4gIC8vIHVuZGVybHlpbmcgc3RyZWFtLlxuICBzZWxmLl9yZWFkID0gZnVuY3Rpb24obikge1xuICAgIGRlYnVnKCd3cmFwcGVkIF9yZWFkJywgbik7XG4gICAgaWYgKHBhdXNlZCkge1xuICAgICAgcGF1c2VkID0gZmFsc2U7XG4gICAgICBzdHJlYW0ucmVzdW1lKCk7XG4gICAgfVxuICB9O1xuXG4gIHJldHVybiBzZWxmO1xufTtcblxuXG4vLyBleHBvc2VkIGZvciB0ZXN0aW5nIHB1cnBvc2VzIG9ubHkuXG5SZWFkYWJsZS5fZnJvbUxpc3QgPSBmcm9tTGlzdDtcblxuLy8gUGx1Y2sgb2ZmIG4gYnl0ZXMgZnJvbSBhbiBhcnJheSBvZiBidWZmZXJzLlxuLy8gTGVuZ3RoIGlzIHRoZSBjb21iaW5lZCBsZW5ndGhzIG9mIGFsbCB0aGUgYnVmZmVycyBpbiB0aGUgbGlzdC5cbmZ1bmN0aW9uIGZyb21MaXN0KG4sIHN0YXRlKSB7XG4gIHZhciBsaXN0ID0gc3RhdGUuYnVmZmVyO1xuICB2YXIgbGVuZ3RoID0gc3RhdGUubGVuZ3RoO1xuICB2YXIgc3RyaW5nTW9kZSA9ICEhc3RhdGUuZGVjb2RlcjtcbiAgdmFyIG9iamVjdE1vZGUgPSAhIXN0YXRlLm9iamVjdE1vZGU7XG4gIHZhciByZXQ7XG5cbiAgLy8gbm90aGluZyBpbiB0aGUgbGlzdCwgZGVmaW5pdGVseSBlbXB0eS5cbiAgaWYgKGxpc3QubGVuZ3RoID09PSAwKVxuICAgIHJldHVybiBudWxsO1xuXG4gIGlmIChsZW5ndGggPT09IDApXG4gICAgcmV0ID0gbnVsbDtcbiAgZWxzZSBpZiAob2JqZWN0TW9kZSlcbiAgICByZXQgPSBsaXN0LnNoaWZ0KCk7XG4gIGVsc2UgaWYgKCFuIHx8IG4gPj0gbGVuZ3RoKSB7XG4gICAgLy8gcmVhZCBpdCBhbGwsIHRydW5jYXRlIHRoZSBhcnJheS5cbiAgICBpZiAoc3RyaW5nTW9kZSlcbiAgICAgIHJldCA9IGxpc3Quam9pbignJyk7XG4gICAgZWxzZSBpZiAobGlzdC5sZW5ndGggPT09IDEpXG4gICAgICByZXQgPSBsaXN0WzBdO1xuICAgIGVsc2VcbiAgICAgIHJldCA9IEJ1ZmZlci5jb25jYXQobGlzdCwgbGVuZ3RoKTtcbiAgICBsaXN0Lmxlbmd0aCA9IDA7XG4gIH0gZWxzZSB7XG4gICAgLy8gcmVhZCBqdXN0IHNvbWUgb2YgaXQuXG4gICAgaWYgKG4gPCBsaXN0WzBdLmxlbmd0aCkge1xuICAgICAgLy8ganVzdCB0YWtlIGEgcGFydCBvZiB0aGUgZmlyc3QgbGlzdCBpdGVtLlxuICAgICAgLy8gc2xpY2UgaXMgdGhlIHNhbWUgZm9yIGJ1ZmZlcnMgYW5kIHN0cmluZ3MuXG4gICAgICB2YXIgYnVmID0gbGlzdFswXTtcbiAgICAgIHJldCA9IGJ1Zi5zbGljZSgwLCBuKTtcbiAgICAgIGxpc3RbMF0gPSBidWYuc2xpY2Uobik7XG4gICAgfSBlbHNlIGlmIChuID09PSBsaXN0WzBdLmxlbmd0aCkge1xuICAgICAgLy8gZmlyc3QgbGlzdCBpcyBhIHBlcmZlY3QgbWF0Y2hcbiAgICAgIHJldCA9IGxpc3Quc2hpZnQoKTtcbiAgICB9IGVsc2Uge1xuICAgICAgLy8gY29tcGxleCBjYXNlLlxuICAgICAgLy8gd2UgaGF2ZSBlbm91Z2ggdG8gY292ZXIgaXQsIGJ1dCBpdCBzcGFucyBwYXN0IHRoZSBmaXJzdCBidWZmZXIuXG4gICAgICBpZiAoc3RyaW5nTW9kZSlcbiAgICAgICAgcmV0ID0gJyc7XG4gICAgICBlbHNlXG4gICAgICAgIHJldCA9IG5ldyBCdWZmZXIobik7XG5cbiAgICAgIHZhciBjID0gMDtcbiAgICAgIGZvciAodmFyIGkgPSAwLCBsID0gbGlzdC5sZW5ndGg7IGkgPCBsICYmIGMgPCBuOyBpKyspIHtcbiAgICAgICAgdmFyIGJ1ZiA9IGxpc3RbMF07XG4gICAgICAgIHZhciBjcHkgPSBNYXRoLm1pbihuIC0gYywgYnVmLmxlbmd0aCk7XG5cbiAgICAgICAgaWYgKHN0cmluZ01vZGUpXG4gICAgICAgICAgcmV0ICs9IGJ1Zi5zbGljZSgwLCBjcHkpO1xuICAgICAgICBlbHNlXG4gICAgICAgICAgYnVmLmNvcHkocmV0LCBjLCAwLCBjcHkpO1xuXG4gICAgICAgIGlmIChjcHkgPCBidWYubGVuZ3RoKVxuICAgICAgICAgIGxpc3RbMF0gPSBidWYuc2xpY2UoY3B5KTtcbiAgICAgICAgZWxzZVxuICAgICAgICAgIGxpc3Quc2hpZnQoKTtcblxuICAgICAgICBjICs9IGNweTtcbiAgICAgIH1cbiAgICB9XG4gIH1cblxuICByZXR1cm4gcmV0O1xufVxuXG5mdW5jdGlvbiBlbmRSZWFkYWJsZShzdHJlYW0pIHtcbiAgdmFyIHN0YXRlID0gc3RyZWFtLl9yZWFkYWJsZVN0YXRlO1xuXG4gIC8vIElmIHdlIGdldCBoZXJlIGJlZm9yZSBjb25zdW1pbmcgYWxsIHRoZSBieXRlcywgdGhlbiB0aGF0IGlzIGFcbiAgLy8gYnVnIGluIG5vZGUuICBTaG91bGQgbmV2ZXIgaGFwcGVuLlxuICBpZiAoc3RhdGUubGVuZ3RoID4gMClcbiAgICB0aHJvdyBuZXcgRXJyb3IoJ2VuZFJlYWRhYmxlIGNhbGxlZCBvbiBub24tZW1wdHkgc3RyZWFtJyk7XG5cbiAgaWYgKCFzdGF0ZS5lbmRFbWl0dGVkKSB7XG4gICAgc3RhdGUuZW5kZWQgPSB0cnVlO1xuICAgIHByb2Nlc3NOZXh0VGljayhlbmRSZWFkYWJsZU5ULCBzdGF0ZSwgc3RyZWFtKTtcbiAgfVxufVxuXG5mdW5jdGlvbiBlbmRSZWFkYWJsZU5UKHN0YXRlLCBzdHJlYW0pIHtcbiAgLy8gQ2hlY2sgdGhhdCB3ZSBkaWRuJ3QgZ2V0IG9uZSBsYXN0IHVuc2hpZnQuXG4gIGlmICghc3RhdGUuZW5kRW1pdHRlZCAmJiBzdGF0ZS5sZW5ndGggPT09IDApIHtcbiAgICBzdGF0ZS5lbmRFbWl0dGVkID0gdHJ1ZTtcbiAgICBzdHJlYW0ucmVhZGFibGUgPSBmYWxzZTtcbiAgICBzdHJlYW0uZW1pdCgnZW5kJyk7XG4gIH1cbn1cblxuZnVuY3Rpb24gZm9yRWFjaCAoeHMsIGYpIHtcbiAgZm9yICh2YXIgaSA9IDAsIGwgPSB4cy5sZW5ndGg7IGkgPCBsOyBpKyspIHtcbiAgICBmKHhzW2ldLCBpKTtcbiAgfVxufVxuXG5mdW5jdGlvbiBpbmRleE9mICh4cywgeCkge1xuICBmb3IgKHZhciBpID0gMCwgbCA9IHhzLmxlbmd0aDsgaSA8IGw7IGkrKykge1xuICAgIGlmICh4c1tpXSA9PT0geCkgcmV0dXJuIGk7XG4gIH1cbiAgcmV0dXJuIC0xO1xufVxuIiwiLy8gYSB0cmFuc2Zvcm0gc3RyZWFtIGlzIGEgcmVhZGFibGUvd3JpdGFibGUgc3RyZWFtIHdoZXJlIHlvdSBkb1xuLy8gc29tZXRoaW5nIHdpdGggdGhlIGRhdGEuICBTb21ldGltZXMgaXQncyBjYWxsZWQgYSBcImZpbHRlclwiLFxuLy8gYnV0IHRoYXQncyBub3QgYSBncmVhdCBuYW1lIGZvciBpdCwgc2luY2UgdGhhdCBpbXBsaWVzIGEgdGhpbmcgd2hlcmVcbi8vIHNvbWUgYml0cyBwYXNzIHRocm91Z2gsIGFuZCBvdGhlcnMgYXJlIHNpbXBseSBpZ25vcmVkLiAgKFRoYXQgd291bGRcbi8vIGJlIGEgdmFsaWQgZXhhbXBsZSBvZiBhIHRyYW5zZm9ybSwgb2YgY291cnNlLilcbi8vXG4vLyBXaGlsZSB0aGUgb3V0cHV0IGlzIGNhdXNhbGx5IHJlbGF0ZWQgdG8gdGhlIGlucHV0LCBpdCdzIG5vdCBhXG4vLyBuZWNlc3NhcmlseSBzeW1tZXRyaWMgb3Igc3luY2hyb25vdXMgdHJhbnNmb3JtYXRpb24uICBGb3IgZXhhbXBsZSxcbi8vIGEgemxpYiBzdHJlYW0gbWlnaHQgdGFrZSBtdWx0aXBsZSBwbGFpbi10ZXh0IHdyaXRlcygpLCBhbmQgdGhlblxuLy8gZW1pdCBhIHNpbmdsZSBjb21wcmVzc2VkIGNodW5rIHNvbWUgdGltZSBpbiB0aGUgZnV0dXJlLlxuLy9cbi8vIEhlcmUncyBob3cgdGhpcyB3b3Jrczpcbi8vXG4vLyBUaGUgVHJhbnNmb3JtIHN0cmVhbSBoYXMgYWxsIHRoZSBhc3BlY3RzIG9mIHRoZSByZWFkYWJsZSBhbmQgd3JpdGFibGVcbi8vIHN0cmVhbSBjbGFzc2VzLiAgV2hlbiB5b3Ugd3JpdGUoY2h1bmspLCB0aGF0IGNhbGxzIF93cml0ZShjaHVuayxjYilcbi8vIGludGVybmFsbHksIGFuZCByZXR1cm5zIGZhbHNlIGlmIHRoZXJlJ3MgYSBsb3Qgb2YgcGVuZGluZyB3cml0ZXNcbi8vIGJ1ZmZlcmVkIHVwLiAgV2hlbiB5b3UgY2FsbCByZWFkKCksIHRoYXQgY2FsbHMgX3JlYWQobikgdW50aWxcbi8vIHRoZXJlJ3MgZW5vdWdoIHBlbmRpbmcgcmVhZGFibGUgZGF0YSBidWZmZXJlZCB1cC5cbi8vXG4vLyBJbiBhIHRyYW5zZm9ybSBzdHJlYW0sIHRoZSB3cml0dGVuIGRhdGEgaXMgcGxhY2VkIGluIGEgYnVmZmVyLiAgV2hlblxuLy8gX3JlYWQobikgaXMgY2FsbGVkLCBpdCB0cmFuc2Zvcm1zIHRoZSBxdWV1ZWQgdXAgZGF0YSwgY2FsbGluZyB0aGVcbi8vIGJ1ZmZlcmVkIF93cml0ZSBjYidzIGFzIGl0IGNvbnN1bWVzIGNodW5rcy4gIElmIGNvbnN1bWluZyBhIHNpbmdsZVxuLy8gd3JpdHRlbiBjaHVuayB3b3VsZCByZXN1bHQgaW4gbXVsdGlwbGUgb3V0cHV0IGNodW5rcywgdGhlbiB0aGUgZmlyc3Rcbi8vIG91dHB1dHRlZCBiaXQgY2FsbHMgdGhlIHJlYWRjYiwgYW5kIHN1YnNlcXVlbnQgY2h1bmtzIGp1c3QgZ28gaW50b1xuLy8gdGhlIHJlYWQgYnVmZmVyLCBhbmQgd2lsbCBjYXVzZSBpdCB0byBlbWl0ICdyZWFkYWJsZScgaWYgbmVjZXNzYXJ5LlxuLy9cbi8vIFRoaXMgd2F5LCBiYWNrLXByZXNzdXJlIGlzIGFjdHVhbGx5IGRldGVybWluZWQgYnkgdGhlIHJlYWRpbmcgc2lkZSxcbi8vIHNpbmNlIF9yZWFkIGhhcyB0byBiZSBjYWxsZWQgdG8gc3RhcnQgcHJvY2Vzc2luZyBhIG5ldyBjaHVuay4gIEhvd2V2ZXIsXG4vLyBhIHBhdGhvbG9naWNhbCBpbmZsYXRlIHR5cGUgb2YgdHJhbnNmb3JtIGNhbiBjYXVzZSBleGNlc3NpdmUgYnVmZmVyaW5nXG4vLyBoZXJlLiAgRm9yIGV4YW1wbGUsIGltYWdpbmUgYSBzdHJlYW0gd2hlcmUgZXZlcnkgYnl0ZSBvZiBpbnB1dCBpc1xuLy8gaW50ZXJwcmV0ZWQgYXMgYW4gaW50ZWdlciBmcm9tIDAtMjU1LCBhbmQgdGhlbiByZXN1bHRzIGluIHRoYXQgbWFueVxuLy8gYnl0ZXMgb2Ygb3V0cHV0LiAgV3JpdGluZyB0aGUgNCBieXRlcyB7ZmYsZmYsZmYsZmZ9IHdvdWxkIHJlc3VsdCBpblxuLy8gMWtiIG9mIGRhdGEgYmVpbmcgb3V0cHV0LiAgSW4gdGhpcyBjYXNlLCB5b3UgY291bGQgd3JpdGUgYSB2ZXJ5IHNtYWxsXG4vLyBhbW91bnQgb2YgaW5wdXQsIGFuZCBlbmQgdXAgd2l0aCBhIHZlcnkgbGFyZ2UgYW1vdW50IG9mIG91dHB1dC4gIEluXG4vLyBzdWNoIGEgcGF0aG9sb2dpY2FsIGluZmxhdGluZyBtZWNoYW5pc20sIHRoZXJlJ2QgYmUgbm8gd2F5IHRvIHRlbGxcbi8vIHRoZSBzeXN0ZW0gdG8gc3RvcCBkb2luZyB0aGUgdHJhbnNmb3JtLiAgQSBzaW5nbGUgNE1CIHdyaXRlIGNvdWxkXG4vLyBjYXVzZSB0aGUgc3lzdGVtIHRvIHJ1biBvdXQgb2YgbWVtb3J5LlxuLy9cbi8vIEhvd2V2ZXIsIGV2ZW4gaW4gc3VjaCBhIHBhdGhvbG9naWNhbCBjYXNlLCBvbmx5IGEgc2luZ2xlIHdyaXR0ZW4gY2h1bmtcbi8vIHdvdWxkIGJlIGNvbnN1bWVkLCBhbmQgdGhlbiB0aGUgcmVzdCB3b3VsZCB3YWl0ICh1bi10cmFuc2Zvcm1lZCkgdW50aWxcbi8vIHRoZSByZXN1bHRzIG9mIHRoZSBwcmV2aW91cyB0cmFuc2Zvcm1lZCBjaHVuayB3ZXJlIGNvbnN1bWVkLlxuXG4ndXNlIHN0cmljdCc7XG5cbm1vZHVsZS5leHBvcnRzID0gVHJhbnNmb3JtO1xuXG52YXIgRHVwbGV4ID0gcmVxdWlyZSgnLi9fc3RyZWFtX2R1cGxleCcpO1xuXG4vKjxyZXBsYWNlbWVudD4qL1xudmFyIHV0aWwgPSByZXF1aXJlKCdjb3JlLXV0aWwtaXMnKTtcbnV0aWwuaW5oZXJpdHMgPSByZXF1aXJlKCdpbmhlcml0cycpO1xuLyo8L3JlcGxhY2VtZW50PiovXG5cbnV0aWwuaW5oZXJpdHMoVHJhbnNmb3JtLCBEdXBsZXgpO1xuXG5cbmZ1bmN0aW9uIFRyYW5zZm9ybVN0YXRlKHN0cmVhbSkge1xuICB0aGlzLmFmdGVyVHJhbnNmb3JtID0gZnVuY3Rpb24oZXIsIGRhdGEpIHtcbiAgICByZXR1cm4gYWZ0ZXJUcmFuc2Zvcm0oc3RyZWFtLCBlciwgZGF0YSk7XG4gIH07XG5cbiAgdGhpcy5uZWVkVHJhbnNmb3JtID0gZmFsc2U7XG4gIHRoaXMudHJhbnNmb3JtaW5nID0gZmFsc2U7XG4gIHRoaXMud3JpdGVjYiA9IG51bGw7XG4gIHRoaXMud3JpdGVjaHVuayA9IG51bGw7XG59XG5cbmZ1bmN0aW9uIGFmdGVyVHJhbnNmb3JtKHN0cmVhbSwgZXIsIGRhdGEpIHtcbiAgdmFyIHRzID0gc3RyZWFtLl90cmFuc2Zvcm1TdGF0ZTtcbiAgdHMudHJhbnNmb3JtaW5nID0gZmFsc2U7XG5cbiAgdmFyIGNiID0gdHMud3JpdGVjYjtcblxuICBpZiAoIWNiKVxuICAgIHJldHVybiBzdHJlYW0uZW1pdCgnZXJyb3InLCBuZXcgRXJyb3IoJ25vIHdyaXRlY2IgaW4gVHJhbnNmb3JtIGNsYXNzJykpO1xuXG4gIHRzLndyaXRlY2h1bmsgPSBudWxsO1xuICB0cy53cml0ZWNiID0gbnVsbDtcblxuICBpZiAoZGF0YSAhPT0gbnVsbCAmJiBkYXRhICE9PSB1bmRlZmluZWQpXG4gICAgc3RyZWFtLnB1c2goZGF0YSk7XG5cbiAgaWYgKGNiKVxuICAgIGNiKGVyKTtcblxuICB2YXIgcnMgPSBzdHJlYW0uX3JlYWRhYmxlU3RhdGU7XG4gIHJzLnJlYWRpbmcgPSBmYWxzZTtcbiAgaWYgKHJzLm5lZWRSZWFkYWJsZSB8fCBycy5sZW5ndGggPCBycy5oaWdoV2F0ZXJNYXJrKSB7XG4gICAgc3RyZWFtLl9yZWFkKHJzLmhpZ2hXYXRlck1hcmspO1xuICB9XG59XG5cblxuZnVuY3Rpb24gVHJhbnNmb3JtKG9wdGlvbnMpIHtcbiAgaWYgKCEodGhpcyBpbnN0YW5jZW9mIFRyYW5zZm9ybSkpXG4gICAgcmV0dXJuIG5ldyBUcmFuc2Zvcm0ob3B0aW9ucyk7XG5cbiAgRHVwbGV4LmNhbGwodGhpcywgb3B0aW9ucyk7XG5cbiAgdGhpcy5fdHJhbnNmb3JtU3RhdGUgPSBuZXcgVHJhbnNmb3JtU3RhdGUodGhpcyk7XG5cbiAgLy8gd2hlbiB0aGUgd3JpdGFibGUgc2lkZSBmaW5pc2hlcywgdGhlbiBmbHVzaCBvdXQgYW55dGhpbmcgcmVtYWluaW5nLlxuICB2YXIgc3RyZWFtID0gdGhpcztcblxuICAvLyBzdGFydCBvdXQgYXNraW5nIGZvciBhIHJlYWRhYmxlIGV2ZW50IG9uY2UgZGF0YSBpcyB0cmFuc2Zvcm1lZC5cbiAgdGhpcy5fcmVhZGFibGVTdGF0ZS5uZWVkUmVhZGFibGUgPSB0cnVlO1xuXG4gIC8vIHdlIGhhdmUgaW1wbGVtZW50ZWQgdGhlIF9yZWFkIG1ldGhvZCwgYW5kIGRvbmUgdGhlIG90aGVyIHRoaW5nc1xuICAvLyB0aGF0IFJlYWRhYmxlIHdhbnRzIGJlZm9yZSB0aGUgZmlyc3QgX3JlYWQgY2FsbCwgc28gdW5zZXQgdGhlXG4gIC8vIHN5bmMgZ3VhcmQgZmxhZy5cbiAgdGhpcy5fcmVhZGFibGVTdGF0ZS5zeW5jID0gZmFsc2U7XG5cbiAgaWYgKG9wdGlvbnMpIHtcbiAgICBpZiAodHlwZW9mIG9wdGlvbnMudHJhbnNmb3JtID09PSAnZnVuY3Rpb24nKVxuICAgICAgdGhpcy5fdHJhbnNmb3JtID0gb3B0aW9ucy50cmFuc2Zvcm07XG5cbiAgICBpZiAodHlwZW9mIG9wdGlvbnMuZmx1c2ggPT09ICdmdW5jdGlvbicpXG4gICAgICB0aGlzLl9mbHVzaCA9IG9wdGlvbnMuZmx1c2g7XG4gIH1cblxuICB0aGlzLm9uY2UoJ3ByZWZpbmlzaCcsIGZ1bmN0aW9uKCkge1xuICAgIGlmICh0eXBlb2YgdGhpcy5fZmx1c2ggPT09ICdmdW5jdGlvbicpXG4gICAgICB0aGlzLl9mbHVzaChmdW5jdGlvbihlcikge1xuICAgICAgICBkb25lKHN0cmVhbSwgZXIpO1xuICAgICAgfSk7XG4gICAgZWxzZVxuICAgICAgZG9uZShzdHJlYW0pO1xuICB9KTtcbn1cblxuVHJhbnNmb3JtLnByb3RvdHlwZS5wdXNoID0gZnVuY3Rpb24oY2h1bmssIGVuY29kaW5nKSB7XG4gIHRoaXMuX3RyYW5zZm9ybVN0YXRlLm5lZWRUcmFuc2Zvcm0gPSBmYWxzZTtcbiAgcmV0dXJuIER1cGxleC5wcm90b3R5cGUucHVzaC5jYWxsKHRoaXMsIGNodW5rLCBlbmNvZGluZyk7XG59O1xuXG4vLyBUaGlzIGlzIHRoZSBwYXJ0IHdoZXJlIHlvdSBkbyBzdHVmZiFcbi8vIG92ZXJyaWRlIHRoaXMgZnVuY3Rpb24gaW4gaW1wbGVtZW50YXRpb24gY2xhc3Nlcy5cbi8vICdjaHVuaycgaXMgYW4gaW5wdXQgY2h1bmsuXG4vL1xuLy8gQ2FsbCBgcHVzaChuZXdDaHVuaylgIHRvIHBhc3MgYWxvbmcgdHJhbnNmb3JtZWQgb3V0cHV0XG4vLyB0byB0aGUgcmVhZGFibGUgc2lkZS4gIFlvdSBtYXkgY2FsbCAncHVzaCcgemVybyBvciBtb3JlIHRpbWVzLlxuLy9cbi8vIENhbGwgYGNiKGVycilgIHdoZW4geW91IGFyZSBkb25lIHdpdGggdGhpcyBjaHVuay4gIElmIHlvdSBwYXNzXG4vLyBhbiBlcnJvciwgdGhlbiB0aGF0J2xsIHB1dCB0aGUgaHVydCBvbiB0aGUgd2hvbGUgb3BlcmF0aW9uLiAgSWYgeW91XG4vLyBuZXZlciBjYWxsIGNiKCksIHRoZW4geW91J2xsIG5ldmVyIGdldCBhbm90aGVyIGNodW5rLlxuVHJhbnNmb3JtLnByb3RvdHlwZS5fdHJhbnNmb3JtID0gZnVuY3Rpb24oY2h1bmssIGVuY29kaW5nLCBjYikge1xuICB0aHJvdyBuZXcgRXJyb3IoJ25vdCBpbXBsZW1lbnRlZCcpO1xufTtcblxuVHJhbnNmb3JtLnByb3RvdHlwZS5fd3JpdGUgPSBmdW5jdGlvbihjaHVuaywgZW5jb2RpbmcsIGNiKSB7XG4gIHZhciB0cyA9IHRoaXMuX3RyYW5zZm9ybVN0YXRlO1xuICB0cy53cml0ZWNiID0gY2I7XG4gIHRzLndyaXRlY2h1bmsgPSBjaHVuaztcbiAgdHMud3JpdGVlbmNvZGluZyA9IGVuY29kaW5nO1xuICBpZiAoIXRzLnRyYW5zZm9ybWluZykge1xuICAgIHZhciBycyA9IHRoaXMuX3JlYWRhYmxlU3RhdGU7XG4gICAgaWYgKHRzLm5lZWRUcmFuc2Zvcm0gfHxcbiAgICAgICAgcnMubmVlZFJlYWRhYmxlIHx8XG4gICAgICAgIHJzLmxlbmd0aCA8IHJzLmhpZ2hXYXRlck1hcmspXG4gICAgICB0aGlzLl9yZWFkKHJzLmhpZ2hXYXRlck1hcmspO1xuICB9XG59O1xuXG4vLyBEb2Vzbid0IG1hdHRlciB3aGF0IHRoZSBhcmdzIGFyZSBoZXJlLlxuLy8gX3RyYW5zZm9ybSBkb2VzIGFsbCB0aGUgd29yay5cbi8vIFRoYXQgd2UgZ290IGhlcmUgbWVhbnMgdGhhdCB0aGUgcmVhZGFibGUgc2lkZSB3YW50cyBtb3JlIGRhdGEuXG5UcmFuc2Zvcm0ucHJvdG90eXBlLl9yZWFkID0gZnVuY3Rpb24obikge1xuICB2YXIgdHMgPSB0aGlzLl90cmFuc2Zvcm1TdGF0ZTtcblxuICBpZiAodHMud3JpdGVjaHVuayAhPT0gbnVsbCAmJiB0cy53cml0ZWNiICYmICF0cy50cmFuc2Zvcm1pbmcpIHtcbiAgICB0cy50cmFuc2Zvcm1pbmcgPSB0cnVlO1xuICAgIHRoaXMuX3RyYW5zZm9ybSh0cy53cml0ZWNodW5rLCB0cy53cml0ZWVuY29kaW5nLCB0cy5hZnRlclRyYW5zZm9ybSk7XG4gIH0gZWxzZSB7XG4gICAgLy8gbWFyayB0aGF0IHdlIG5lZWQgYSB0cmFuc2Zvcm0sIHNvIHRoYXQgYW55IGRhdGEgdGhhdCBjb21lcyBpblxuICAgIC8vIHdpbGwgZ2V0IHByb2Nlc3NlZCwgbm93IHRoYXQgd2UndmUgYXNrZWQgZm9yIGl0LlxuICAgIHRzLm5lZWRUcmFuc2Zvcm0gPSB0cnVlO1xuICB9XG59O1xuXG5cbmZ1bmN0aW9uIGRvbmUoc3RyZWFtLCBlcikge1xuICBpZiAoZXIpXG4gICAgcmV0dXJuIHN0cmVhbS5lbWl0KCdlcnJvcicsIGVyKTtcblxuICAvLyBpZiB0aGVyZSdzIG5vdGhpbmcgaW4gdGhlIHdyaXRlIGJ1ZmZlciwgdGhlbiB0aGF0IG1lYW5zXG4gIC8vIHRoYXQgbm90aGluZyBtb3JlIHdpbGwgZXZlciBiZSBwcm92aWRlZFxuICB2YXIgd3MgPSBzdHJlYW0uX3dyaXRhYmxlU3RhdGU7XG4gIHZhciB0cyA9IHN0cmVhbS5fdHJhbnNmb3JtU3RhdGU7XG5cbiAgaWYgKHdzLmxlbmd0aClcbiAgICB0aHJvdyBuZXcgRXJyb3IoJ2NhbGxpbmcgdHJhbnNmb3JtIGRvbmUgd2hlbiB3cy5sZW5ndGggIT0gMCcpO1xuXG4gIGlmICh0cy50cmFuc2Zvcm1pbmcpXG4gICAgdGhyb3cgbmV3IEVycm9yKCdjYWxsaW5nIHRyYW5zZm9ybSBkb25lIHdoZW4gc3RpbGwgdHJhbnNmb3JtaW5nJyk7XG5cbiAgcmV0dXJuIHN0cmVhbS5wdXNoKG51bGwpO1xufVxuIiwiLy8gQSBiaXQgc2ltcGxlciB0aGFuIHJlYWRhYmxlIHN0cmVhbXMuXG4vLyBJbXBsZW1lbnQgYW4gYXN5bmMgLl93cml0ZShjaHVuaywgZW5jb2RpbmcsIGNiKSwgYW5kIGl0J2xsIGhhbmRsZSBhbGxcbi8vIHRoZSBkcmFpbiBldmVudCBlbWlzc2lvbiBhbmQgYnVmZmVyaW5nLlxuXG4ndXNlIHN0cmljdCc7XG5cbm1vZHVsZS5leHBvcnRzID0gV3JpdGFibGU7XG5cbi8qPHJlcGxhY2VtZW50PiovXG52YXIgcHJvY2Vzc05leHRUaWNrID0gcmVxdWlyZSgncHJvY2Vzcy1uZXh0aWNrLWFyZ3MnKTtcbi8qPC9yZXBsYWNlbWVudD4qL1xuXG5cbi8qPHJlcGxhY2VtZW50PiovXG52YXIgQnVmZmVyID0gcmVxdWlyZSgnYnVmZmVyJykuQnVmZmVyO1xuLyo8L3JlcGxhY2VtZW50PiovXG5cbldyaXRhYmxlLldyaXRhYmxlU3RhdGUgPSBXcml0YWJsZVN0YXRlO1xuXG5cbi8qPHJlcGxhY2VtZW50PiovXG52YXIgdXRpbCA9IHJlcXVpcmUoJ2NvcmUtdXRpbC1pcycpO1xudXRpbC5pbmhlcml0cyA9IHJlcXVpcmUoJ2luaGVyaXRzJyk7XG4vKjwvcmVwbGFjZW1lbnQ+Ki9cblxuXG4vKjxyZXBsYWNlbWVudD4qL1xudmFyIGludGVybmFsVXRpbCA9IHtcbiAgZGVwcmVjYXRlOiByZXF1aXJlKCd1dGlsLWRlcHJlY2F0ZScpXG59O1xuLyo8L3JlcGxhY2VtZW50PiovXG5cblxuXG4vKjxyZXBsYWNlbWVudD4qL1xudmFyIFN0cmVhbTtcbihmdW5jdGlvbiAoKXt0cnl7XG4gIFN0cmVhbSA9IHJlcXVpcmUoJ3N0JyArICdyZWFtJyk7XG59Y2F0Y2goXyl7fWZpbmFsbHl7XG4gIGlmICghU3RyZWFtKVxuICAgIFN0cmVhbSA9IHJlcXVpcmUoJ2V2ZW50cycpLkV2ZW50RW1pdHRlcjtcbn19KCkpXG4vKjwvcmVwbGFjZW1lbnQ+Ki9cblxudmFyIEJ1ZmZlciA9IHJlcXVpcmUoJ2J1ZmZlcicpLkJ1ZmZlcjtcblxudXRpbC5pbmhlcml0cyhXcml0YWJsZSwgU3RyZWFtKTtcblxuZnVuY3Rpb24gbm9wKCkge31cblxuZnVuY3Rpb24gV3JpdGVSZXEoY2h1bmssIGVuY29kaW5nLCBjYikge1xuICB0aGlzLmNodW5rID0gY2h1bms7XG4gIHRoaXMuZW5jb2RpbmcgPSBlbmNvZGluZztcbiAgdGhpcy5jYWxsYmFjayA9IGNiO1xuICB0aGlzLm5leHQgPSBudWxsO1xufVxuXG52YXIgRHVwbGV4O1xuZnVuY3Rpb24gV3JpdGFibGVTdGF0ZShvcHRpb25zLCBzdHJlYW0pIHtcbiAgRHVwbGV4ID0gRHVwbGV4IHx8IHJlcXVpcmUoJy4vX3N0cmVhbV9kdXBsZXgnKTtcblxuICBvcHRpb25zID0gb3B0aW9ucyB8fCB7fTtcblxuICAvLyBvYmplY3Qgc3RyZWFtIGZsYWcgdG8gaW5kaWNhdGUgd2hldGhlciBvciBub3QgdGhpcyBzdHJlYW1cbiAgLy8gY29udGFpbnMgYnVmZmVycyBvciBvYmplY3RzLlxuICB0aGlzLm9iamVjdE1vZGUgPSAhIW9wdGlvbnMub2JqZWN0TW9kZTtcblxuICBpZiAoc3RyZWFtIGluc3RhbmNlb2YgRHVwbGV4KVxuICAgIHRoaXMub2JqZWN0TW9kZSA9IHRoaXMub2JqZWN0TW9kZSB8fCAhIW9wdGlvbnMud3JpdGFibGVPYmplY3RNb2RlO1xuXG4gIC8vIHRoZSBwb2ludCBhdCB3aGljaCB3cml0ZSgpIHN0YXJ0cyByZXR1cm5pbmcgZmFsc2VcbiAgLy8gTm90ZTogMCBpcyBhIHZhbGlkIHZhbHVlLCBtZWFucyB0aGF0IHdlIGFsd2F5cyByZXR1cm4gZmFsc2UgaWZcbiAgLy8gdGhlIGVudGlyZSBidWZmZXIgaXMgbm90IGZsdXNoZWQgaW1tZWRpYXRlbHkgb24gd3JpdGUoKVxuICB2YXIgaHdtID0gb3B0aW9ucy5oaWdoV2F0ZXJNYXJrO1xuICB2YXIgZGVmYXVsdEh3bSA9IHRoaXMub2JqZWN0TW9kZSA/IDE2IDogMTYgKiAxMDI0O1xuICB0aGlzLmhpZ2hXYXRlck1hcmsgPSAoaHdtIHx8IGh3bSA9PT0gMCkgPyBod20gOiBkZWZhdWx0SHdtO1xuXG4gIC8vIGNhc3QgdG8gaW50cy5cbiAgdGhpcy5oaWdoV2F0ZXJNYXJrID0gfn50aGlzLmhpZ2hXYXRlck1hcms7XG5cbiAgdGhpcy5uZWVkRHJhaW4gPSBmYWxzZTtcbiAgLy8gYXQgdGhlIHN0YXJ0IG9mIGNhbGxpbmcgZW5kKClcbiAgdGhpcy5lbmRpbmcgPSBmYWxzZTtcbiAgLy8gd2hlbiBlbmQoKSBoYXMgYmVlbiBjYWxsZWQsIGFuZCByZXR1cm5lZFxuICB0aGlzLmVuZGVkID0gZmFsc2U7XG4gIC8vIHdoZW4gJ2ZpbmlzaCcgaXMgZW1pdHRlZFxuICB0aGlzLmZpbmlzaGVkID0gZmFsc2U7XG5cbiAgLy8gc2hvdWxkIHdlIGRlY29kZSBzdHJpbmdzIGludG8gYnVmZmVycyBiZWZvcmUgcGFzc2luZyB0byBfd3JpdGU/XG4gIC8vIHRoaXMgaXMgaGVyZSBzbyB0aGF0IHNvbWUgbm9kZS1jb3JlIHN0cmVhbXMgY2FuIG9wdGltaXplIHN0cmluZ1xuICAvLyBoYW5kbGluZyBhdCBhIGxvd2VyIGxldmVsLlxuICB2YXIgbm9EZWNvZGUgPSBvcHRpb25zLmRlY29kZVN0cmluZ3MgPT09IGZhbHNlO1xuICB0aGlzLmRlY29kZVN0cmluZ3MgPSAhbm9EZWNvZGU7XG5cbiAgLy8gQ3J5cHRvIGlzIGtpbmQgb2Ygb2xkIGFuZCBjcnVzdHkuICBIaXN0b3JpY2FsbHksIGl0cyBkZWZhdWx0IHN0cmluZ1xuICAvLyBlbmNvZGluZyBpcyAnYmluYXJ5JyBzbyB3ZSBoYXZlIHRvIG1ha2UgdGhpcyBjb25maWd1cmFibGUuXG4gIC8vIEV2ZXJ5dGhpbmcgZWxzZSBpbiB0aGUgdW5pdmVyc2UgdXNlcyAndXRmOCcsIHRob3VnaC5cbiAgdGhpcy5kZWZhdWx0RW5jb2RpbmcgPSBvcHRpb25zLmRlZmF1bHRFbmNvZGluZyB8fCAndXRmOCc7XG5cbiAgLy8gbm90IGFuIGFjdHVhbCBidWZmZXIgd2Uga2VlcCB0cmFjayBvZiwgYnV0IGEgbWVhc3VyZW1lbnRcbiAgLy8gb2YgaG93IG11Y2ggd2UncmUgd2FpdGluZyB0byBnZXQgcHVzaGVkIHRvIHNvbWUgdW5kZXJseWluZ1xuICAvLyBzb2NrZXQgb3IgZmlsZS5cbiAgdGhpcy5sZW5ndGggPSAwO1xuXG4gIC8vIGEgZmxhZyB0byBzZWUgd2hlbiB3ZSdyZSBpbiB0aGUgbWlkZGxlIG9mIGEgd3JpdGUuXG4gIHRoaXMud3JpdGluZyA9IGZhbHNlO1xuXG4gIC8vIHdoZW4gdHJ1ZSBhbGwgd3JpdGVzIHdpbGwgYmUgYnVmZmVyZWQgdW50aWwgLnVuY29yaygpIGNhbGxcbiAgdGhpcy5jb3JrZWQgPSAwO1xuXG4gIC8vIGEgZmxhZyB0byBiZSBhYmxlIHRvIHRlbGwgaWYgdGhlIG9ud3JpdGUgY2IgaXMgY2FsbGVkIGltbWVkaWF0ZWx5LFxuICAvLyBvciBvbiBhIGxhdGVyIHRpY2suICBXZSBzZXQgdGhpcyB0byB0cnVlIGF0IGZpcnN0LCBiZWNhdXNlIGFueVxuICAvLyBhY3Rpb25zIHRoYXQgc2hvdWxkbid0IGhhcHBlbiB1bnRpbCBcImxhdGVyXCIgc2hvdWxkIGdlbmVyYWxseSBhbHNvXG4gIC8vIG5vdCBoYXBwZW4gYmVmb3JlIHRoZSBmaXJzdCB3cml0ZSBjYWxsLlxuICB0aGlzLnN5bmMgPSB0cnVlO1xuXG4gIC8vIGEgZmxhZyB0byBrbm93IGlmIHdlJ3JlIHByb2Nlc3NpbmcgcHJldmlvdXNseSBidWZmZXJlZCBpdGVtcywgd2hpY2hcbiAgLy8gbWF5IGNhbGwgdGhlIF93cml0ZSgpIGNhbGxiYWNrIGluIHRoZSBzYW1lIHRpY2ssIHNvIHRoYXQgd2UgZG9uJ3RcbiAgLy8gZW5kIHVwIGluIGFuIG92ZXJsYXBwZWQgb253cml0ZSBzaXR1YXRpb24uXG4gIHRoaXMuYnVmZmVyUHJvY2Vzc2luZyA9IGZhbHNlO1xuXG4gIC8vIHRoZSBjYWxsYmFjayB0aGF0J3MgcGFzc2VkIHRvIF93cml0ZShjaHVuayxjYilcbiAgdGhpcy5vbndyaXRlID0gZnVuY3Rpb24oZXIpIHtcbiAgICBvbndyaXRlKHN0cmVhbSwgZXIpO1xuICB9O1xuXG4gIC8vIHRoZSBjYWxsYmFjayB0aGF0IHRoZSB1c2VyIHN1cHBsaWVzIHRvIHdyaXRlKGNodW5rLGVuY29kaW5nLGNiKVxuICB0aGlzLndyaXRlY2IgPSBudWxsO1xuXG4gIC8vIHRoZSBhbW91bnQgdGhhdCBpcyBiZWluZyB3cml0dGVuIHdoZW4gX3dyaXRlIGlzIGNhbGxlZC5cbiAgdGhpcy53cml0ZWxlbiA9IDA7XG5cbiAgdGhpcy5idWZmZXJlZFJlcXVlc3QgPSBudWxsO1xuICB0aGlzLmxhc3RCdWZmZXJlZFJlcXVlc3QgPSBudWxsO1xuXG4gIC8vIG51bWJlciBvZiBwZW5kaW5nIHVzZXItc3VwcGxpZWQgd3JpdGUgY2FsbGJhY2tzXG4gIC8vIHRoaXMgbXVzdCBiZSAwIGJlZm9yZSAnZmluaXNoJyBjYW4gYmUgZW1pdHRlZFxuICB0aGlzLnBlbmRpbmdjYiA9IDA7XG5cbiAgLy8gZW1pdCBwcmVmaW5pc2ggaWYgdGhlIG9ubHkgdGhpbmcgd2UncmUgd2FpdGluZyBmb3IgaXMgX3dyaXRlIGNic1xuICAvLyBUaGlzIGlzIHJlbGV2YW50IGZvciBzeW5jaHJvbm91cyBUcmFuc2Zvcm0gc3RyZWFtc1xuICB0aGlzLnByZWZpbmlzaGVkID0gZmFsc2U7XG5cbiAgLy8gVHJ1ZSBpZiB0aGUgZXJyb3Igd2FzIGFscmVhZHkgZW1pdHRlZCBhbmQgc2hvdWxkIG5vdCBiZSB0aHJvd24gYWdhaW5cbiAgdGhpcy5lcnJvckVtaXR0ZWQgPSBmYWxzZTtcbn1cblxuV3JpdGFibGVTdGF0ZS5wcm90b3R5cGUuZ2V0QnVmZmVyID0gZnVuY3Rpb24gd3JpdGFibGVTdGF0ZUdldEJ1ZmZlcigpIHtcbiAgdmFyIGN1cnJlbnQgPSB0aGlzLmJ1ZmZlcmVkUmVxdWVzdDtcbiAgdmFyIG91dCA9IFtdO1xuICB3aGlsZSAoY3VycmVudCkge1xuICAgIG91dC5wdXNoKGN1cnJlbnQpO1xuICAgIGN1cnJlbnQgPSBjdXJyZW50Lm5leHQ7XG4gIH1cbiAgcmV0dXJuIG91dDtcbn07XG5cbihmdW5jdGlvbiAoKXt0cnkge1xuT2JqZWN0LmRlZmluZVByb3BlcnR5KFdyaXRhYmxlU3RhdGUucHJvdG90eXBlLCAnYnVmZmVyJywge1xuICBnZXQ6IGludGVybmFsVXRpbC5kZXByZWNhdGUoZnVuY3Rpb24oKSB7XG4gICAgcmV0dXJuIHRoaXMuZ2V0QnVmZmVyKCk7XG4gIH0sICdfd3JpdGFibGVTdGF0ZS5idWZmZXIgaXMgZGVwcmVjYXRlZC4gVXNlIF93cml0YWJsZVN0YXRlLmdldEJ1ZmZlciAnICtcbiAgICAgJ2luc3RlYWQuJylcbn0pO1xufWNhdGNoKF8pe319KCkpO1xuXG5cbnZhciBEdXBsZXg7XG5mdW5jdGlvbiBXcml0YWJsZShvcHRpb25zKSB7XG4gIER1cGxleCA9IER1cGxleCB8fCByZXF1aXJlKCcuL19zdHJlYW1fZHVwbGV4Jyk7XG5cbiAgLy8gV3JpdGFibGUgY3RvciBpcyBhcHBsaWVkIHRvIER1cGxleGVzLCB0aG91Z2ggdGhleSdyZSBub3RcbiAgLy8gaW5zdGFuY2VvZiBXcml0YWJsZSwgdGhleSdyZSBpbnN0YW5jZW9mIFJlYWRhYmxlLlxuICBpZiAoISh0aGlzIGluc3RhbmNlb2YgV3JpdGFibGUpICYmICEodGhpcyBpbnN0YW5jZW9mIER1cGxleCkpXG4gICAgcmV0dXJuIG5ldyBXcml0YWJsZShvcHRpb25zKTtcblxuICB0aGlzLl93cml0YWJsZVN0YXRlID0gbmV3IFdyaXRhYmxlU3RhdGUob3B0aW9ucywgdGhpcyk7XG5cbiAgLy8gbGVnYWN5LlxuICB0aGlzLndyaXRhYmxlID0gdHJ1ZTtcblxuICBpZiAob3B0aW9ucykge1xuICAgIGlmICh0eXBlb2Ygb3B0aW9ucy53cml0ZSA9PT0gJ2Z1bmN0aW9uJylcbiAgICAgIHRoaXMuX3dyaXRlID0gb3B0aW9ucy53cml0ZTtcblxuICAgIGlmICh0eXBlb2Ygb3B0aW9ucy53cml0ZXYgPT09ICdmdW5jdGlvbicpXG4gICAgICB0aGlzLl93cml0ZXYgPSBvcHRpb25zLndyaXRldjtcbiAgfVxuXG4gIFN0cmVhbS5jYWxsKHRoaXMpO1xufVxuXG4vLyBPdGhlcndpc2UgcGVvcGxlIGNhbiBwaXBlIFdyaXRhYmxlIHN0cmVhbXMsIHdoaWNoIGlzIGp1c3Qgd3JvbmcuXG5Xcml0YWJsZS5wcm90b3R5cGUucGlwZSA9IGZ1bmN0aW9uKCkge1xuICB0aGlzLmVtaXQoJ2Vycm9yJywgbmV3IEVycm9yKCdDYW5ub3QgcGlwZS4gTm90IHJlYWRhYmxlLicpKTtcbn07XG5cblxuZnVuY3Rpb24gd3JpdGVBZnRlckVuZChzdHJlYW0sIGNiKSB7XG4gIHZhciBlciA9IG5ldyBFcnJvcignd3JpdGUgYWZ0ZXIgZW5kJyk7XG4gIC8vIFRPRE86IGRlZmVyIGVycm9yIGV2ZW50cyBjb25zaXN0ZW50bHkgZXZlcnl3aGVyZSwgbm90IGp1c3QgdGhlIGNiXG4gIHN0cmVhbS5lbWl0KCdlcnJvcicsIGVyKTtcbiAgcHJvY2Vzc05leHRUaWNrKGNiLCBlcik7XG59XG5cbi8vIElmIHdlIGdldCBzb21ldGhpbmcgdGhhdCBpcyBub3QgYSBidWZmZXIsIHN0cmluZywgbnVsbCwgb3IgdW5kZWZpbmVkLFxuLy8gYW5kIHdlJ3JlIG5vdCBpbiBvYmplY3RNb2RlLCB0aGVuIHRoYXQncyBhbiBlcnJvci5cbi8vIE90aGVyd2lzZSBzdHJlYW0gY2h1bmtzIGFyZSBhbGwgY29uc2lkZXJlZCB0byBiZSBvZiBsZW5ndGg9MSwgYW5kIHRoZVxuLy8gd2F0ZXJtYXJrcyBkZXRlcm1pbmUgaG93IG1hbnkgb2JqZWN0cyB0byBrZWVwIGluIHRoZSBidWZmZXIsIHJhdGhlciB0aGFuXG4vLyBob3cgbWFueSBieXRlcyBvciBjaGFyYWN0ZXJzLlxuZnVuY3Rpb24gdmFsaWRDaHVuayhzdHJlYW0sIHN0YXRlLCBjaHVuaywgY2IpIHtcbiAgdmFyIHZhbGlkID0gdHJ1ZTtcblxuICBpZiAoIShCdWZmZXIuaXNCdWZmZXIoY2h1bmspKSAmJlxuICAgICAgdHlwZW9mIGNodW5rICE9PSAnc3RyaW5nJyAmJlxuICAgICAgY2h1bmsgIT09IG51bGwgJiZcbiAgICAgIGNodW5rICE9PSB1bmRlZmluZWQgJiZcbiAgICAgICFzdGF0ZS5vYmplY3RNb2RlKSB7XG4gICAgdmFyIGVyID0gbmV3IFR5cGVFcnJvcignSW52YWxpZCBub24tc3RyaW5nL2J1ZmZlciBjaHVuaycpO1xuICAgIHN0cmVhbS5lbWl0KCdlcnJvcicsIGVyKTtcbiAgICBwcm9jZXNzTmV4dFRpY2soY2IsIGVyKTtcbiAgICB2YWxpZCA9IGZhbHNlO1xuICB9XG4gIHJldHVybiB2YWxpZDtcbn1cblxuV3JpdGFibGUucHJvdG90eXBlLndyaXRlID0gZnVuY3Rpb24oY2h1bmssIGVuY29kaW5nLCBjYikge1xuICB2YXIgc3RhdGUgPSB0aGlzLl93cml0YWJsZVN0YXRlO1xuICB2YXIgcmV0ID0gZmFsc2U7XG5cbiAgaWYgKHR5cGVvZiBlbmNvZGluZyA9PT0gJ2Z1bmN0aW9uJykge1xuICAgIGNiID0gZW5jb2Rpbmc7XG4gICAgZW5jb2RpbmcgPSBudWxsO1xuICB9XG5cbiAgaWYgKEJ1ZmZlci5pc0J1ZmZlcihjaHVuaykpXG4gICAgZW5jb2RpbmcgPSAnYnVmZmVyJztcbiAgZWxzZSBpZiAoIWVuY29kaW5nKVxuICAgIGVuY29kaW5nID0gc3RhdGUuZGVmYXVsdEVuY29kaW5nO1xuXG4gIGlmICh0eXBlb2YgY2IgIT09ICdmdW5jdGlvbicpXG4gICAgY2IgPSBub3A7XG5cbiAgaWYgKHN0YXRlLmVuZGVkKVxuICAgIHdyaXRlQWZ0ZXJFbmQodGhpcywgY2IpO1xuICBlbHNlIGlmICh2YWxpZENodW5rKHRoaXMsIHN0YXRlLCBjaHVuaywgY2IpKSB7XG4gICAgc3RhdGUucGVuZGluZ2NiKys7XG4gICAgcmV0ID0gd3JpdGVPckJ1ZmZlcih0aGlzLCBzdGF0ZSwgY2h1bmssIGVuY29kaW5nLCBjYik7XG4gIH1cblxuICByZXR1cm4gcmV0O1xufTtcblxuV3JpdGFibGUucHJvdG90eXBlLmNvcmsgPSBmdW5jdGlvbigpIHtcbiAgdmFyIHN0YXRlID0gdGhpcy5fd3JpdGFibGVTdGF0ZTtcblxuICBzdGF0ZS5jb3JrZWQrKztcbn07XG5cbldyaXRhYmxlLnByb3RvdHlwZS51bmNvcmsgPSBmdW5jdGlvbigpIHtcbiAgdmFyIHN0YXRlID0gdGhpcy5fd3JpdGFibGVTdGF0ZTtcblxuICBpZiAoc3RhdGUuY29ya2VkKSB7XG4gICAgc3RhdGUuY29ya2VkLS07XG5cbiAgICBpZiAoIXN0YXRlLndyaXRpbmcgJiZcbiAgICAgICAgIXN0YXRlLmNvcmtlZCAmJlxuICAgICAgICAhc3RhdGUuZmluaXNoZWQgJiZcbiAgICAgICAgIXN0YXRlLmJ1ZmZlclByb2Nlc3NpbmcgJiZcbiAgICAgICAgc3RhdGUuYnVmZmVyZWRSZXF1ZXN0KVxuICAgICAgY2xlYXJCdWZmZXIodGhpcywgc3RhdGUpO1xuICB9XG59O1xuXG5Xcml0YWJsZS5wcm90b3R5cGUuc2V0RGVmYXVsdEVuY29kaW5nID0gZnVuY3Rpb24gc2V0RGVmYXVsdEVuY29kaW5nKGVuY29kaW5nKSB7XG4gIC8vIG5vZGU6OlBhcnNlRW5jb2RpbmcoKSByZXF1aXJlcyBsb3dlciBjYXNlLlxuICBpZiAodHlwZW9mIGVuY29kaW5nID09PSAnc3RyaW5nJylcbiAgICBlbmNvZGluZyA9IGVuY29kaW5nLnRvTG93ZXJDYXNlKCk7XG4gIGlmICghKFsnaGV4JywgJ3V0ZjgnLCAndXRmLTgnLCAnYXNjaWknLCAnYmluYXJ5JywgJ2Jhc2U2NCcsXG4ndWNzMicsICd1Y3MtMicsJ3V0ZjE2bGUnLCAndXRmLTE2bGUnLCAncmF3J11cbi5pbmRleE9mKChlbmNvZGluZyArICcnKS50b0xvd2VyQ2FzZSgpKSA+IC0xKSlcbiAgICB0aHJvdyBuZXcgVHlwZUVycm9yKCdVbmtub3duIGVuY29kaW5nOiAnICsgZW5jb2RpbmcpO1xuICB0aGlzLl93cml0YWJsZVN0YXRlLmRlZmF1bHRFbmNvZGluZyA9IGVuY29kaW5nO1xufTtcblxuZnVuY3Rpb24gZGVjb2RlQ2h1bmsoc3RhdGUsIGNodW5rLCBlbmNvZGluZykge1xuICBpZiAoIXN0YXRlLm9iamVjdE1vZGUgJiZcbiAgICAgIHN0YXRlLmRlY29kZVN0cmluZ3MgIT09IGZhbHNlICYmXG4gICAgICB0eXBlb2YgY2h1bmsgPT09ICdzdHJpbmcnKSB7XG4gICAgY2h1bmsgPSBuZXcgQnVmZmVyKGNodW5rLCBlbmNvZGluZyk7XG4gIH1cbiAgcmV0dXJuIGNodW5rO1xufVxuXG4vLyBpZiB3ZSdyZSBhbHJlYWR5IHdyaXRpbmcgc29tZXRoaW5nLCB0aGVuIGp1c3QgcHV0IHRoaXNcbi8vIGluIHRoZSBxdWV1ZSwgYW5kIHdhaXQgb3VyIHR1cm4uICBPdGhlcndpc2UsIGNhbGwgX3dyaXRlXG4vLyBJZiB3ZSByZXR1cm4gZmFsc2UsIHRoZW4gd2UgbmVlZCBhIGRyYWluIGV2ZW50LCBzbyBzZXQgdGhhdCBmbGFnLlxuZnVuY3Rpb24gd3JpdGVPckJ1ZmZlcihzdHJlYW0sIHN0YXRlLCBjaHVuaywgZW5jb2RpbmcsIGNiKSB7XG4gIGNodW5rID0gZGVjb2RlQ2h1bmsoc3RhdGUsIGNodW5rLCBlbmNvZGluZyk7XG5cbiAgaWYgKEJ1ZmZlci5pc0J1ZmZlcihjaHVuaykpXG4gICAgZW5jb2RpbmcgPSAnYnVmZmVyJztcbiAgdmFyIGxlbiA9IHN0YXRlLm9iamVjdE1vZGUgPyAxIDogY2h1bmsubGVuZ3RoO1xuXG4gIHN0YXRlLmxlbmd0aCArPSBsZW47XG5cbiAgdmFyIHJldCA9IHN0YXRlLmxlbmd0aCA8IHN0YXRlLmhpZ2hXYXRlck1hcms7XG4gIC8vIHdlIG11c3QgZW5zdXJlIHRoYXQgcHJldmlvdXMgbmVlZERyYWluIHdpbGwgbm90IGJlIHJlc2V0IHRvIGZhbHNlLlxuICBpZiAoIXJldClcbiAgICBzdGF0ZS5uZWVkRHJhaW4gPSB0cnVlO1xuXG4gIGlmIChzdGF0ZS53cml0aW5nIHx8IHN0YXRlLmNvcmtlZCkge1xuICAgIHZhciBsYXN0ID0gc3RhdGUubGFzdEJ1ZmZlcmVkUmVxdWVzdDtcbiAgICBzdGF0ZS5sYXN0QnVmZmVyZWRSZXF1ZXN0ID0gbmV3IFdyaXRlUmVxKGNodW5rLCBlbmNvZGluZywgY2IpO1xuICAgIGlmIChsYXN0KSB7XG4gICAgICBsYXN0Lm5leHQgPSBzdGF0ZS5sYXN0QnVmZmVyZWRSZXF1ZXN0O1xuICAgIH0gZWxzZSB7XG4gICAgICBzdGF0ZS5idWZmZXJlZFJlcXVlc3QgPSBzdGF0ZS5sYXN0QnVmZmVyZWRSZXF1ZXN0O1xuICAgIH1cbiAgfSBlbHNlIHtcbiAgICBkb1dyaXRlKHN0cmVhbSwgc3RhdGUsIGZhbHNlLCBsZW4sIGNodW5rLCBlbmNvZGluZywgY2IpO1xuICB9XG5cbiAgcmV0dXJuIHJldDtcbn1cblxuZnVuY3Rpb24gZG9Xcml0ZShzdHJlYW0sIHN0YXRlLCB3cml0ZXYsIGxlbiwgY2h1bmssIGVuY29kaW5nLCBjYikge1xuICBzdGF0ZS53cml0ZWxlbiA9IGxlbjtcbiAgc3RhdGUud3JpdGVjYiA9IGNiO1xuICBzdGF0ZS53cml0aW5nID0gdHJ1ZTtcbiAgc3RhdGUuc3luYyA9IHRydWU7XG4gIGlmICh3cml0ZXYpXG4gICAgc3RyZWFtLl93cml0ZXYoY2h1bmssIHN0YXRlLm9ud3JpdGUpO1xuICBlbHNlXG4gICAgc3RyZWFtLl93cml0ZShjaHVuaywgZW5jb2RpbmcsIHN0YXRlLm9ud3JpdGUpO1xuICBzdGF0ZS5zeW5jID0gZmFsc2U7XG59XG5cbmZ1bmN0aW9uIG9ud3JpdGVFcnJvcihzdHJlYW0sIHN0YXRlLCBzeW5jLCBlciwgY2IpIHtcbiAgLS1zdGF0ZS5wZW5kaW5nY2I7XG4gIGlmIChzeW5jKVxuICAgIHByb2Nlc3NOZXh0VGljayhjYiwgZXIpO1xuICBlbHNlXG4gICAgY2IoZXIpO1xuXG4gIHN0cmVhbS5fd3JpdGFibGVTdGF0ZS5lcnJvckVtaXR0ZWQgPSB0cnVlO1xuICBzdHJlYW0uZW1pdCgnZXJyb3InLCBlcik7XG59XG5cbmZ1bmN0aW9uIG9ud3JpdGVTdGF0ZVVwZGF0ZShzdGF0ZSkge1xuICBzdGF0ZS53cml0aW5nID0gZmFsc2U7XG4gIHN0YXRlLndyaXRlY2IgPSBudWxsO1xuICBzdGF0ZS5sZW5ndGggLT0gc3RhdGUud3JpdGVsZW47XG4gIHN0YXRlLndyaXRlbGVuID0gMDtcbn1cblxuZnVuY3Rpb24gb253cml0ZShzdHJlYW0sIGVyKSB7XG4gIHZhciBzdGF0ZSA9IHN0cmVhbS5fd3JpdGFibGVTdGF0ZTtcbiAgdmFyIHN5bmMgPSBzdGF0ZS5zeW5jO1xuICB2YXIgY2IgPSBzdGF0ZS53cml0ZWNiO1xuXG4gIG9ud3JpdGVTdGF0ZVVwZGF0ZShzdGF0ZSk7XG5cbiAgaWYgKGVyKVxuICAgIG9ud3JpdGVFcnJvcihzdHJlYW0sIHN0YXRlLCBzeW5jLCBlciwgY2IpO1xuICBlbHNlIHtcbiAgICAvLyBDaGVjayBpZiB3ZSdyZSBhY3R1YWxseSByZWFkeSB0byBmaW5pc2gsIGJ1dCBkb24ndCBlbWl0IHlldFxuICAgIHZhciBmaW5pc2hlZCA9IG5lZWRGaW5pc2goc3RhdGUpO1xuXG4gICAgaWYgKCFmaW5pc2hlZCAmJlxuICAgICAgICAhc3RhdGUuY29ya2VkICYmXG4gICAgICAgICFzdGF0ZS5idWZmZXJQcm9jZXNzaW5nICYmXG4gICAgICAgIHN0YXRlLmJ1ZmZlcmVkUmVxdWVzdCkge1xuICAgICAgY2xlYXJCdWZmZXIoc3RyZWFtLCBzdGF0ZSk7XG4gICAgfVxuXG4gICAgaWYgKHN5bmMpIHtcbiAgICAgIHByb2Nlc3NOZXh0VGljayhhZnRlcldyaXRlLCBzdHJlYW0sIHN0YXRlLCBmaW5pc2hlZCwgY2IpO1xuICAgIH0gZWxzZSB7XG4gICAgICBhZnRlcldyaXRlKHN0cmVhbSwgc3RhdGUsIGZpbmlzaGVkLCBjYik7XG4gICAgfVxuICB9XG59XG5cbmZ1bmN0aW9uIGFmdGVyV3JpdGUoc3RyZWFtLCBzdGF0ZSwgZmluaXNoZWQsIGNiKSB7XG4gIGlmICghZmluaXNoZWQpXG4gICAgb253cml0ZURyYWluKHN0cmVhbSwgc3RhdGUpO1xuICBzdGF0ZS5wZW5kaW5nY2ItLTtcbiAgY2IoKTtcbiAgZmluaXNoTWF5YmUoc3RyZWFtLCBzdGF0ZSk7XG59XG5cbi8vIE11c3QgZm9yY2UgY2FsbGJhY2sgdG8gYmUgY2FsbGVkIG9uIG5leHRUaWNrLCBzbyB0aGF0IHdlIGRvbid0XG4vLyBlbWl0ICdkcmFpbicgYmVmb3JlIHRoZSB3cml0ZSgpIGNvbnN1bWVyIGdldHMgdGhlICdmYWxzZScgcmV0dXJuXG4vLyB2YWx1ZSwgYW5kIGhhcyBhIGNoYW5jZSB0byBhdHRhY2ggYSAnZHJhaW4nIGxpc3RlbmVyLlxuZnVuY3Rpb24gb253cml0ZURyYWluKHN0cmVhbSwgc3RhdGUpIHtcbiAgaWYgKHN0YXRlLmxlbmd0aCA9PT0gMCAmJiBzdGF0ZS5uZWVkRHJhaW4pIHtcbiAgICBzdGF0ZS5uZWVkRHJhaW4gPSBmYWxzZTtcbiAgICBzdHJlYW0uZW1pdCgnZHJhaW4nKTtcbiAgfVxufVxuXG5cbi8vIGlmIHRoZXJlJ3Mgc29tZXRoaW5nIGluIHRoZSBidWZmZXIgd2FpdGluZywgdGhlbiBwcm9jZXNzIGl0XG5mdW5jdGlvbiBjbGVhckJ1ZmZlcihzdHJlYW0sIHN0YXRlKSB7XG4gIHN0YXRlLmJ1ZmZlclByb2Nlc3NpbmcgPSB0cnVlO1xuICB2YXIgZW50cnkgPSBzdGF0ZS5idWZmZXJlZFJlcXVlc3Q7XG5cbiAgaWYgKHN0cmVhbS5fd3JpdGV2ICYmIGVudHJ5ICYmIGVudHJ5Lm5leHQpIHtcbiAgICAvLyBGYXN0IGNhc2UsIHdyaXRlIGV2ZXJ5dGhpbmcgdXNpbmcgX3dyaXRldigpXG4gICAgdmFyIGJ1ZmZlciA9IFtdO1xuICAgIHZhciBjYnMgPSBbXTtcbiAgICB3aGlsZSAoZW50cnkpIHtcbiAgICAgIGNicy5wdXNoKGVudHJ5LmNhbGxiYWNrKTtcbiAgICAgIGJ1ZmZlci5wdXNoKGVudHJ5KTtcbiAgICAgIGVudHJ5ID0gZW50cnkubmV4dDtcbiAgICB9XG5cbiAgICAvLyBjb3VudCB0aGUgb25lIHdlIGFyZSBhZGRpbmcsIGFzIHdlbGwuXG4gICAgLy8gVE9ETyhpc2FhY3MpIGNsZWFuIHRoaXMgdXBcbiAgICBzdGF0ZS5wZW5kaW5nY2IrKztcbiAgICBzdGF0ZS5sYXN0QnVmZmVyZWRSZXF1ZXN0ID0gbnVsbDtcbiAgICBkb1dyaXRlKHN0cmVhbSwgc3RhdGUsIHRydWUsIHN0YXRlLmxlbmd0aCwgYnVmZmVyLCAnJywgZnVuY3Rpb24oZXJyKSB7XG4gICAgICBmb3IgKHZhciBpID0gMDsgaSA8IGNicy5sZW5ndGg7IGkrKykge1xuICAgICAgICBzdGF0ZS5wZW5kaW5nY2ItLTtcbiAgICAgICAgY2JzW2ldKGVycik7XG4gICAgICB9XG4gICAgfSk7XG5cbiAgICAvLyBDbGVhciBidWZmZXJcbiAgfSBlbHNlIHtcbiAgICAvLyBTbG93IGNhc2UsIHdyaXRlIGNodW5rcyBvbmUtYnktb25lXG4gICAgd2hpbGUgKGVudHJ5KSB7XG4gICAgICB2YXIgY2h1bmsgPSBlbnRyeS5jaHVuaztcbiAgICAgIHZhciBlbmNvZGluZyA9IGVudHJ5LmVuY29kaW5nO1xuICAgICAgdmFyIGNiID0gZW50cnkuY2FsbGJhY2s7XG4gICAgICB2YXIgbGVuID0gc3RhdGUub2JqZWN0TW9kZSA/IDEgOiBjaHVuay5sZW5ndGg7XG5cbiAgICAgIGRvV3JpdGUoc3RyZWFtLCBzdGF0ZSwgZmFsc2UsIGxlbiwgY2h1bmssIGVuY29kaW5nLCBjYik7XG4gICAgICBlbnRyeSA9IGVudHJ5Lm5leHQ7XG4gICAgICAvLyBpZiB3ZSBkaWRuJ3QgY2FsbCB0aGUgb253cml0ZSBpbW1lZGlhdGVseSwgdGhlblxuICAgICAgLy8gaXQgbWVhbnMgdGhhdCB3ZSBuZWVkIHRvIHdhaXQgdW50aWwgaXQgZG9lcy5cbiAgICAgIC8vIGFsc28sIHRoYXQgbWVhbnMgdGhhdCB0aGUgY2h1bmsgYW5kIGNiIGFyZSBjdXJyZW50bHlcbiAgICAgIC8vIGJlaW5nIHByb2Nlc3NlZCwgc28gbW92ZSB0aGUgYnVmZmVyIGNvdW50ZXIgcGFzdCB0aGVtLlxuICAgICAgaWYgKHN0YXRlLndyaXRpbmcpIHtcbiAgICAgICAgYnJlYWs7XG4gICAgICB9XG4gICAgfVxuXG4gICAgaWYgKGVudHJ5ID09PSBudWxsKVxuICAgICAgc3RhdGUubGFzdEJ1ZmZlcmVkUmVxdWVzdCA9IG51bGw7XG4gIH1cbiAgc3RhdGUuYnVmZmVyZWRSZXF1ZXN0ID0gZW50cnk7XG4gIHN0YXRlLmJ1ZmZlclByb2Nlc3NpbmcgPSBmYWxzZTtcbn1cblxuV3JpdGFibGUucHJvdG90eXBlLl93cml0ZSA9IGZ1bmN0aW9uKGNodW5rLCBlbmNvZGluZywgY2IpIHtcbiAgY2IobmV3IEVycm9yKCdub3QgaW1wbGVtZW50ZWQnKSk7XG59O1xuXG5Xcml0YWJsZS5wcm90b3R5cGUuX3dyaXRldiA9IG51bGw7XG5cbldyaXRhYmxlLnByb3RvdHlwZS5lbmQgPSBmdW5jdGlvbihjaHVuaywgZW5jb2RpbmcsIGNiKSB7XG4gIHZhciBzdGF0ZSA9IHRoaXMuX3dyaXRhYmxlU3RhdGU7XG5cbiAgaWYgKHR5cGVvZiBjaHVuayA9PT0gJ2Z1bmN0aW9uJykge1xuICAgIGNiID0gY2h1bms7XG4gICAgY2h1bmsgPSBudWxsO1xuICAgIGVuY29kaW5nID0gbnVsbDtcbiAgfSBlbHNlIGlmICh0eXBlb2YgZW5jb2RpbmcgPT09ICdmdW5jdGlvbicpIHtcbiAgICBjYiA9IGVuY29kaW5nO1xuICAgIGVuY29kaW5nID0gbnVsbDtcbiAgfVxuXG4gIGlmIChjaHVuayAhPT0gbnVsbCAmJiBjaHVuayAhPT0gdW5kZWZpbmVkKVxuICAgIHRoaXMud3JpdGUoY2h1bmssIGVuY29kaW5nKTtcblxuICAvLyAuZW5kKCkgZnVsbHkgdW5jb3Jrc1xuICBpZiAoc3RhdGUuY29ya2VkKSB7XG4gICAgc3RhdGUuY29ya2VkID0gMTtcbiAgICB0aGlzLnVuY29yaygpO1xuICB9XG5cbiAgLy8gaWdub3JlIHVubmVjZXNzYXJ5IGVuZCgpIGNhbGxzLlxuICBpZiAoIXN0YXRlLmVuZGluZyAmJiAhc3RhdGUuZmluaXNoZWQpXG4gICAgZW5kV3JpdGFibGUodGhpcywgc3RhdGUsIGNiKTtcbn07XG5cblxuZnVuY3Rpb24gbmVlZEZpbmlzaChzdGF0ZSkge1xuICByZXR1cm4gKHN0YXRlLmVuZGluZyAmJlxuICAgICAgICAgIHN0YXRlLmxlbmd0aCA9PT0gMCAmJlxuICAgICAgICAgIHN0YXRlLmJ1ZmZlcmVkUmVxdWVzdCA9PT0gbnVsbCAmJlxuICAgICAgICAgICFzdGF0ZS5maW5pc2hlZCAmJlxuICAgICAgICAgICFzdGF0ZS53cml0aW5nKTtcbn1cblxuZnVuY3Rpb24gcHJlZmluaXNoKHN0cmVhbSwgc3RhdGUpIHtcbiAgaWYgKCFzdGF0ZS5wcmVmaW5pc2hlZCkge1xuICAgIHN0YXRlLnByZWZpbmlzaGVkID0gdHJ1ZTtcbiAgICBzdHJlYW0uZW1pdCgncHJlZmluaXNoJyk7XG4gIH1cbn1cblxuZnVuY3Rpb24gZmluaXNoTWF5YmUoc3RyZWFtLCBzdGF0ZSkge1xuICB2YXIgbmVlZCA9IG5lZWRGaW5pc2goc3RhdGUpO1xuICBpZiAobmVlZCkge1xuICAgIGlmIChzdGF0ZS5wZW5kaW5nY2IgPT09IDApIHtcbiAgICAgIHByZWZpbmlzaChzdHJlYW0sIHN0YXRlKTtcbiAgICAgIHN0YXRlLmZpbmlzaGVkID0gdHJ1ZTtcbiAgICAgIHN0cmVhbS5lbWl0KCdmaW5pc2gnKTtcbiAgICB9IGVsc2Uge1xuICAgICAgcHJlZmluaXNoKHN0cmVhbSwgc3RhdGUpO1xuICAgIH1cbiAgfVxuICByZXR1cm4gbmVlZDtcbn1cblxuZnVuY3Rpb24gZW5kV3JpdGFibGUoc3RyZWFtLCBzdGF0ZSwgY2IpIHtcbiAgc3RhdGUuZW5kaW5nID0gdHJ1ZTtcbiAgZmluaXNoTWF5YmUoc3RyZWFtLCBzdGF0ZSk7XG4gIGlmIChjYikge1xuICAgIGlmIChzdGF0ZS5maW5pc2hlZClcbiAgICAgIHByb2Nlc3NOZXh0VGljayhjYik7XG4gICAgZWxzZVxuICAgICAgc3RyZWFtLm9uY2UoJ2ZpbmlzaCcsIGNiKTtcbiAgfVxuICBzdGF0ZS5lbmRlZCA9IHRydWU7XG59XG4iLCIvLyBDb3B5cmlnaHQgSm95ZW50LCBJbmMuIGFuZCBvdGhlciBOb2RlIGNvbnRyaWJ1dG9ycy5cbi8vXG4vLyBQZXJtaXNzaW9uIGlzIGhlcmVieSBncmFudGVkLCBmcmVlIG9mIGNoYXJnZSwgdG8gYW55IHBlcnNvbiBvYnRhaW5pbmcgYVxuLy8gY29weSBvZiB0aGlzIHNvZnR3YXJlIGFuZCBhc3NvY2lhdGVkIGRvY3VtZW50YXRpb24gZmlsZXMgKHRoZVxuLy8gXCJTb2Z0d2FyZVwiKSwgdG8gZGVhbCBpbiB0aGUgU29mdHdhcmUgd2l0aG91dCByZXN0cmljdGlvbiwgaW5jbHVkaW5nXG4vLyB3aXRob3V0IGxpbWl0YXRpb24gdGhlIHJpZ2h0cyB0byB1c2UsIGNvcHksIG1vZGlmeSwgbWVyZ2UsIHB1Ymxpc2gsXG4vLyBkaXN0cmlidXRlLCBzdWJsaWNlbnNlLCBhbmQvb3Igc2VsbCBjb3BpZXMgb2YgdGhlIFNvZnR3YXJlLCBhbmQgdG8gcGVybWl0XG4vLyBwZXJzb25zIHRvIHdob20gdGhlIFNvZnR3YXJlIGlzIGZ1cm5pc2hlZCB0byBkbyBzbywgc3ViamVjdCB0byB0aGVcbi8vIGZvbGxvd2luZyBjb25kaXRpb25zOlxuLy9cbi8vIFRoZSBhYm92ZSBjb3B5cmlnaHQgbm90aWNlIGFuZCB0aGlzIHBlcm1pc3Npb24gbm90aWNlIHNoYWxsIGJlIGluY2x1ZGVkXG4vLyBpbiBhbGwgY29waWVzIG9yIHN1YnN0YW50aWFsIHBvcnRpb25zIG9mIHRoZSBTb2Z0d2FyZS5cbi8vXG4vLyBUSEUgU09GVFdBUkUgSVMgUFJPVklERUQgXCJBUyBJU1wiLCBXSVRIT1VUIFdBUlJBTlRZIE9GIEFOWSBLSU5ELCBFWFBSRVNTXG4vLyBPUiBJTVBMSUVELCBJTkNMVURJTkcgQlVUIE5PVCBMSU1JVEVEIFRPIFRIRSBXQVJSQU5USUVTIE9GXG4vLyBNRVJDSEFOVEFCSUxJVFksIEZJVE5FU1MgRk9SIEEgUEFSVElDVUxBUiBQVVJQT1NFIEFORCBOT05JTkZSSU5HRU1FTlQuIElOXG4vLyBOTyBFVkVOVCBTSEFMTCBUSEUgQVVUSE9SUyBPUiBDT1BZUklHSFQgSE9MREVSUyBCRSBMSUFCTEUgRk9SIEFOWSBDTEFJTSxcbi8vIERBTUFHRVMgT1IgT1RIRVIgTElBQklMSVRZLCBXSEVUSEVSIElOIEFOIEFDVElPTiBPRiBDT05UUkFDVCwgVE9SVCBPUlxuLy8gT1RIRVJXSVNFLCBBUklTSU5HIEZST00sIE9VVCBPRiBPUiBJTiBDT05ORUNUSU9OIFdJVEggVEhFIFNPRlRXQVJFIE9SIFRIRVxuLy8gVVNFIE9SIE9USEVSIERFQUxJTkdTIElOIFRIRSBTT0ZUV0FSRS5cblxuLy8gTk9URTogVGhlc2UgdHlwZSBjaGVja2luZyBmdW5jdGlvbnMgaW50ZW50aW9uYWxseSBkb24ndCB1c2UgYGluc3RhbmNlb2ZgXG4vLyBiZWNhdXNlIGl0IGlzIGZyYWdpbGUgYW5kIGNhbiBiZSBlYXNpbHkgZmFrZWQgd2l0aCBgT2JqZWN0LmNyZWF0ZSgpYC5cblxuZnVuY3Rpb24gaXNBcnJheShhcmcpIHtcbiAgaWYgKEFycmF5LmlzQXJyYXkpIHtcbiAgICByZXR1cm4gQXJyYXkuaXNBcnJheShhcmcpO1xuICB9XG4gIHJldHVybiBvYmplY3RUb1N0cmluZyhhcmcpID09PSAnW29iamVjdCBBcnJheV0nO1xufVxuZXhwb3J0cy5pc0FycmF5ID0gaXNBcnJheTtcblxuZnVuY3Rpb24gaXNCb29sZWFuKGFyZykge1xuICByZXR1cm4gdHlwZW9mIGFyZyA9PT0gJ2Jvb2xlYW4nO1xufVxuZXhwb3J0cy5pc0Jvb2xlYW4gPSBpc0Jvb2xlYW47XG5cbmZ1bmN0aW9uIGlzTnVsbChhcmcpIHtcbiAgcmV0dXJuIGFyZyA9PT0gbnVsbDtcbn1cbmV4cG9ydHMuaXNOdWxsID0gaXNOdWxsO1xuXG5mdW5jdGlvbiBpc051bGxPclVuZGVmaW5lZChhcmcpIHtcbiAgcmV0dXJuIGFyZyA9PSBudWxsO1xufVxuZXhwb3J0cy5pc051bGxPclVuZGVmaW5lZCA9IGlzTnVsbE9yVW5kZWZpbmVkO1xuXG5mdW5jdGlvbiBpc051bWJlcihhcmcpIHtcbiAgcmV0dXJuIHR5cGVvZiBhcmcgPT09ICdudW1iZXInO1xufVxuZXhwb3J0cy5pc051bWJlciA9IGlzTnVtYmVyO1xuXG5mdW5jdGlvbiBpc1N0cmluZyhhcmcpIHtcbiAgcmV0dXJuIHR5cGVvZiBhcmcgPT09ICdzdHJpbmcnO1xufVxuZXhwb3J0cy5pc1N0cmluZyA9IGlzU3RyaW5nO1xuXG5mdW5jdGlvbiBpc1N5bWJvbChhcmcpIHtcbiAgcmV0dXJuIHR5cGVvZiBhcmcgPT09ICdzeW1ib2wnO1xufVxuZXhwb3J0cy5pc1N5bWJvbCA9IGlzU3ltYm9sO1xuXG5mdW5jdGlvbiBpc1VuZGVmaW5lZChhcmcpIHtcbiAgcmV0dXJuIGFyZyA9PT0gdm9pZCAwO1xufVxuZXhwb3J0cy5pc1VuZGVmaW5lZCA9IGlzVW5kZWZpbmVkO1xuXG5mdW5jdGlvbiBpc1JlZ0V4cChyZSkge1xuICByZXR1cm4gb2JqZWN0VG9TdHJpbmcocmUpID09PSAnW29iamVjdCBSZWdFeHBdJztcbn1cbmV4cG9ydHMuaXNSZWdFeHAgPSBpc1JlZ0V4cDtcblxuZnVuY3Rpb24gaXNPYmplY3QoYXJnKSB7XG4gIHJldHVybiB0eXBlb2YgYXJnID09PSAnb2JqZWN0JyAmJiBhcmcgIT09IG51bGw7XG59XG5leHBvcnRzLmlzT2JqZWN0ID0gaXNPYmplY3Q7XG5cbmZ1bmN0aW9uIGlzRGF0ZShkKSB7XG4gIHJldHVybiBvYmplY3RUb1N0cmluZyhkKSA9PT0gJ1tvYmplY3QgRGF0ZV0nO1xufVxuZXhwb3J0cy5pc0RhdGUgPSBpc0RhdGU7XG5cbmZ1bmN0aW9uIGlzRXJyb3IoZSkge1xuICByZXR1cm4gKG9iamVjdFRvU3RyaW5nKGUpID09PSAnW29iamVjdCBFcnJvcl0nIHx8IGUgaW5zdGFuY2VvZiBFcnJvcik7XG59XG5leHBvcnRzLmlzRXJyb3IgPSBpc0Vycm9yO1xuXG5mdW5jdGlvbiBpc0Z1bmN0aW9uKGFyZykge1xuICByZXR1cm4gdHlwZW9mIGFyZyA9PT0gJ2Z1bmN0aW9uJztcbn1cbmV4cG9ydHMuaXNGdW5jdGlvbiA9IGlzRnVuY3Rpb247XG5cbmZ1bmN0aW9uIGlzUHJpbWl0aXZlKGFyZykge1xuICByZXR1cm4gYXJnID09PSBudWxsIHx8XG4gICAgICAgICB0eXBlb2YgYXJnID09PSAnYm9vbGVhbicgfHxcbiAgICAgICAgIHR5cGVvZiBhcmcgPT09ICdudW1iZXInIHx8XG4gICAgICAgICB0eXBlb2YgYXJnID09PSAnc3RyaW5nJyB8fFxuICAgICAgICAgdHlwZW9mIGFyZyA9PT0gJ3N5bWJvbCcgfHwgIC8vIEVTNiBzeW1ib2xcbiAgICAgICAgIHR5cGVvZiBhcmcgPT09ICd1bmRlZmluZWQnO1xufVxuZXhwb3J0cy5pc1ByaW1pdGl2ZSA9IGlzUHJpbWl0aXZlO1xuXG5leHBvcnRzLmlzQnVmZmVyID0gQnVmZmVyLmlzQnVmZmVyO1xuXG5mdW5jdGlvbiBvYmplY3RUb1N0cmluZyhvKSB7XG4gIHJldHVybiBPYmplY3QucHJvdG90eXBlLnRvU3RyaW5nLmNhbGwobyk7XG59XG4iLCIndXNlIHN0cmljdCc7XG5cbmlmICghcHJvY2Vzcy52ZXJzaW9uIHx8XG4gICAgcHJvY2Vzcy52ZXJzaW9uLmluZGV4T2YoJ3YwLicpID09PSAwIHx8XG4gICAgcHJvY2Vzcy52ZXJzaW9uLmluZGV4T2YoJ3YxLicpID09PSAwICYmIHByb2Nlc3MudmVyc2lvbi5pbmRleE9mKCd2MS44LicpICE9PSAwKSB7XG4gIG1vZHVsZS5leHBvcnRzID0gbmV4dFRpY2s7XG59IGVsc2Uge1xuICBtb2R1bGUuZXhwb3J0cyA9IHByb2Nlc3MubmV4dFRpY2s7XG59XG5cbmZ1bmN0aW9uIG5leHRUaWNrKGZuKSB7XG4gIHZhciBhcmdzID0gbmV3IEFycmF5KGFyZ3VtZW50cy5sZW5ndGggLSAxKTtcbiAgdmFyIGkgPSAwO1xuICB3aGlsZSAoaSA8IGFyZ3MubGVuZ3RoKSB7XG4gICAgYXJnc1tpKytdID0gYXJndW1lbnRzW2ldO1xuICB9XG4gIHByb2Nlc3MubmV4dFRpY2soZnVuY3Rpb24gYWZ0ZXJUaWNrKCkge1xuICAgIGZuLmFwcGx5KG51bGwsIGFyZ3MpO1xuICB9KTtcbn1cbiIsIlxuLyoqXG4gKiBNb2R1bGUgZXhwb3J0cy5cbiAqL1xuXG5tb2R1bGUuZXhwb3J0cyA9IGRlcHJlY2F0ZTtcblxuLyoqXG4gKiBNYXJrIHRoYXQgYSBtZXRob2Qgc2hvdWxkIG5vdCBiZSB1c2VkLlxuICogUmV0dXJucyBhIG1vZGlmaWVkIGZ1bmN0aW9uIHdoaWNoIHdhcm5zIG9uY2UgYnkgZGVmYXVsdC5cbiAqXG4gKiBJZiBgbG9jYWxTdG9yYWdlLm5vRGVwcmVjYXRpb24gPSB0cnVlYCBpcyBzZXQsIHRoZW4gaXQgaXMgYSBuby1vcC5cbiAqXG4gKiBJZiBgbG9jYWxTdG9yYWdlLnRocm93RGVwcmVjYXRpb24gPSB0cnVlYCBpcyBzZXQsIHRoZW4gZGVwcmVjYXRlZCBmdW5jdGlvbnNcbiAqIHdpbGwgdGhyb3cgYW4gRXJyb3Igd2hlbiBpbnZva2VkLlxuICpcbiAqIElmIGBsb2NhbFN0b3JhZ2UudHJhY2VEZXByZWNhdGlvbiA9IHRydWVgIGlzIHNldCwgdGhlbiBkZXByZWNhdGVkIGZ1bmN0aW9uc1xuICogd2lsbCBpbnZva2UgYGNvbnNvbGUudHJhY2UoKWAgaW5zdGVhZCBvZiBgY29uc29sZS5lcnJvcigpYC5cbiAqXG4gKiBAcGFyYW0ge0Z1bmN0aW9ufSBmbiAtIHRoZSBmdW5jdGlvbiB0byBkZXByZWNhdGVcbiAqIEBwYXJhbSB7U3RyaW5nfSBtc2cgLSB0aGUgc3RyaW5nIHRvIHByaW50IHRvIHRoZSBjb25zb2xlIHdoZW4gYGZuYCBpcyBpbnZva2VkXG4gKiBAcmV0dXJucyB7RnVuY3Rpb259IGEgbmV3IFwiZGVwcmVjYXRlZFwiIHZlcnNpb24gb2YgYGZuYFxuICogQGFwaSBwdWJsaWNcbiAqL1xuXG5mdW5jdGlvbiBkZXByZWNhdGUgKGZuLCBtc2cpIHtcbiAgaWYgKGNvbmZpZygnbm9EZXByZWNhdGlvbicpKSB7XG4gICAgcmV0dXJuIGZuO1xuICB9XG5cbiAgdmFyIHdhcm5lZCA9IGZhbHNlO1xuICBmdW5jdGlvbiBkZXByZWNhdGVkKCkge1xuICAgIGlmICghd2FybmVkKSB7XG4gICAgICBpZiAoY29uZmlnKCd0aHJvd0RlcHJlY2F0aW9uJykpIHtcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKG1zZyk7XG4gICAgICB9IGVsc2UgaWYgKGNvbmZpZygndHJhY2VEZXByZWNhdGlvbicpKSB7XG4gICAgICAgIGNvbnNvbGUudHJhY2UobXNnKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIGNvbnNvbGUud2Fybihtc2cpO1xuICAgICAgfVxuICAgICAgd2FybmVkID0gdHJ1ZTtcbiAgICB9XG4gICAgcmV0dXJuIGZuLmFwcGx5KHRoaXMsIGFyZ3VtZW50cyk7XG4gIH1cblxuICByZXR1cm4gZGVwcmVjYXRlZDtcbn1cblxuLyoqXG4gKiBDaGVja3MgYGxvY2FsU3RvcmFnZWAgZm9yIGJvb2xlYW4gdmFsdWVzIGZvciB0aGUgZ2l2ZW4gYG5hbWVgLlxuICpcbiAqIEBwYXJhbSB7U3RyaW5nfSBuYW1lXG4gKiBAcmV0dXJucyB7Qm9vbGVhbn1cbiAqIEBhcGkgcHJpdmF0ZVxuICovXG5cbmZ1bmN0aW9uIGNvbmZpZyAobmFtZSkge1xuICAvLyBhY2Nlc3NpbmcgZ2xvYmFsLmxvY2FsU3RvcmFnZSBjYW4gdHJpZ2dlciBhIERPTUV4Y2VwdGlvbiBpbiBzYW5kYm94ZWQgaWZyYW1lc1xuICB0cnkge1xuICAgIGlmICghZ2xvYmFsLmxvY2FsU3RvcmFnZSkgcmV0dXJuIGZhbHNlO1xuICB9IGNhdGNoIChfKSB7XG4gICAgcmV0dXJuIGZhbHNlO1xuICB9XG4gIHZhciB2YWwgPSBnbG9iYWwubG9jYWxTdG9yYWdlW25hbWVdO1xuICBpZiAobnVsbCA9PSB2YWwpIHJldHVybiBmYWxzZTtcbiAgcmV0dXJuIFN0cmluZyh2YWwpLnRvTG93ZXJDYXNlKCkgPT09ICd0cnVlJztcbn1cbiIsIm1vZHVsZS5leHBvcnRzID0gcmVxdWlyZShcIi4vbGliL19zdHJlYW1fcGFzc3Rocm91Z2guanNcIilcbiIsInZhciBTdHJlYW0gPSAoZnVuY3Rpb24gKCl7XG4gIHRyeSB7XG4gICAgcmV0dXJuIHJlcXVpcmUoJ3N0JyArICdyZWFtJyk7IC8vIGhhY2sgdG8gZml4IGEgY2lyY3VsYXIgZGVwZW5kZW5jeSBpc3N1ZSB3aGVuIHVzZWQgd2l0aCBicm93c2VyaWZ5XG4gIH0gY2F0Y2goXyl7fVxufSgpKTtcbmV4cG9ydHMgPSBtb2R1bGUuZXhwb3J0cyA9IHJlcXVpcmUoJy4vbGliL19zdHJlYW1fcmVhZGFibGUuanMnKTtcbmV4cG9ydHMuU3RyZWFtID0gU3RyZWFtIHx8IGV4cG9ydHM7XG5leHBvcnRzLlJlYWRhYmxlID0gZXhwb3J0cztcbmV4cG9ydHMuV3JpdGFibGUgPSByZXF1aXJlKCcuL2xpYi9fc3RyZWFtX3dyaXRhYmxlLmpzJyk7XG5leHBvcnRzLkR1cGxleCA9IHJlcXVpcmUoJy4vbGliL19zdHJlYW1fZHVwbGV4LmpzJyk7XG5leHBvcnRzLlRyYW5zZm9ybSA9IHJlcXVpcmUoJy4vbGliL19zdHJlYW1fdHJhbnNmb3JtLmpzJyk7XG5leHBvcnRzLlBhc3NUaHJvdWdoID0gcmVxdWlyZSgnLi9saWIvX3N0cmVhbV9wYXNzdGhyb3VnaC5qcycpO1xuIiwibW9kdWxlLmV4cG9ydHMgPSByZXF1aXJlKFwiLi9saWIvX3N0cmVhbV90cmFuc2Zvcm0uanNcIilcbiIsIm1vZHVsZS5leHBvcnRzID0gcmVxdWlyZShcIi4vbGliL19zdHJlYW1fd3JpdGFibGUuanNcIilcbiIsIi8vIENvcHlyaWdodCBKb3llbnQsIEluYy4gYW5kIG90aGVyIE5vZGUgY29udHJpYnV0b3JzLlxuLy9cbi8vIFBlcm1pc3Npb24gaXMgaGVyZWJ5IGdyYW50ZWQsIGZyZWUgb2YgY2hhcmdlLCB0byBhbnkgcGVyc29uIG9idGFpbmluZyBhXG4vLyBjb3B5IG9mIHRoaXMgc29mdHdhcmUgYW5kIGFzc29jaWF0ZWQgZG9jdW1lbnRhdGlvbiBmaWxlcyAodGhlXG4vLyBcIlNvZnR3YXJlXCIpLCB0byBkZWFsIGluIHRoZSBTb2Z0d2FyZSB3aXRob3V0IHJlc3RyaWN0aW9uLCBpbmNsdWRpbmdcbi8vIHdpdGhvdXQgbGltaXRhdGlvbiB0aGUgcmlnaHRzIHRvIHVzZSwgY29weSwgbW9kaWZ5LCBtZXJnZSwgcHVibGlzaCxcbi8vIGRpc3RyaWJ1dGUsIHN1YmxpY2Vuc2UsIGFuZC9vciBzZWxsIGNvcGllcyBvZiB0aGUgU29mdHdhcmUsIGFuZCB0byBwZXJtaXRcbi8vIHBlcnNvbnMgdG8gd2hvbSB0aGUgU29mdHdhcmUgaXMgZnVybmlzaGVkIHRvIGRvIHNvLCBzdWJqZWN0IHRvIHRoZVxuLy8gZm9sbG93aW5nIGNvbmRpdGlvbnM6XG4vL1xuLy8gVGhlIGFib3ZlIGNvcHlyaWdodCBub3RpY2UgYW5kIHRoaXMgcGVybWlzc2lvbiBub3RpY2Ugc2hhbGwgYmUgaW5jbHVkZWRcbi8vIGluIGFsbCBjb3BpZXMgb3Igc3Vic3RhbnRpYWwgcG9ydGlvbnMgb2YgdGhlIFNvZnR3YXJlLlxuLy9cbi8vIFRIRSBTT0ZUV0FSRSBJUyBQUk9WSURFRCBcIkFTIElTXCIsIFdJVEhPVVQgV0FSUkFOVFkgT0YgQU5ZIEtJTkQsIEVYUFJFU1Ncbi8vIE9SIElNUExJRUQsIElOQ0xVRElORyBCVVQgTk9UIExJTUlURUQgVE8gVEhFIFdBUlJBTlRJRVMgT0Zcbi8vIE1FUkNIQU5UQUJJTElUWSwgRklUTkVTUyBGT1IgQSBQQVJUSUNVTEFSIFBVUlBPU0UgQU5EIE5PTklORlJJTkdFTUVOVC4gSU5cbi8vIE5PIEVWRU5UIFNIQUxMIFRIRSBBVVRIT1JTIE9SIENPUFlSSUdIVCBIT0xERVJTIEJFIExJQUJMRSBGT1IgQU5ZIENMQUlNLFxuLy8gREFNQUdFUyBPUiBPVEhFUiBMSUFCSUxJVFksIFdIRVRIRVIgSU4gQU4gQUNUSU9OIE9GIENPTlRSQUNULCBUT1JUIE9SXG4vLyBPVEhFUldJU0UsIEFSSVNJTkcgRlJPTSwgT1VUIE9GIE9SIElOIENPTk5FQ1RJT04gV0lUSCBUSEUgU09GVFdBUkUgT1IgVEhFXG4vLyBVU0UgT1IgT1RIRVIgREVBTElOR1MgSU4gVEhFIFNPRlRXQVJFLlxuXG5tb2R1bGUuZXhwb3J0cyA9IFN0cmVhbTtcblxudmFyIEVFID0gcmVxdWlyZSgnZXZlbnRzJykuRXZlbnRFbWl0dGVyO1xudmFyIGluaGVyaXRzID0gcmVxdWlyZSgnaW5oZXJpdHMnKTtcblxuaW5oZXJpdHMoU3RyZWFtLCBFRSk7XG5TdHJlYW0uUmVhZGFibGUgPSByZXF1aXJlKCdyZWFkYWJsZS1zdHJlYW0vcmVhZGFibGUuanMnKTtcblN0cmVhbS5Xcml0YWJsZSA9IHJlcXVpcmUoJ3JlYWRhYmxlLXN0cmVhbS93cml0YWJsZS5qcycpO1xuU3RyZWFtLkR1cGxleCA9IHJlcXVpcmUoJ3JlYWRhYmxlLXN0cmVhbS9kdXBsZXguanMnKTtcblN0cmVhbS5UcmFuc2Zvcm0gPSByZXF1aXJlKCdyZWFkYWJsZS1zdHJlYW0vdHJhbnNmb3JtLmpzJyk7XG5TdHJlYW0uUGFzc1Rocm91Z2ggPSByZXF1aXJlKCdyZWFkYWJsZS1zdHJlYW0vcGFzc3Rocm91Z2guanMnKTtcblxuLy8gQmFja3dhcmRzLWNvbXBhdCB3aXRoIG5vZGUgMC40LnhcblN0cmVhbS5TdHJlYW0gPSBTdHJlYW07XG5cblxuXG4vLyBvbGQtc3R5bGUgc3RyZWFtcy4gIE5vdGUgdGhhdCB0aGUgcGlwZSBtZXRob2QgKHRoZSBvbmx5IHJlbGV2YW50XG4vLyBwYXJ0IG9mIHRoaXMgY2xhc3MpIGlzIG92ZXJyaWRkZW4gaW4gdGhlIFJlYWRhYmxlIGNsYXNzLlxuXG5mdW5jdGlvbiBTdHJlYW0oKSB7XG4gIEVFLmNhbGwodGhpcyk7XG59XG5cblN0cmVhbS5wcm90b3R5cGUucGlwZSA9IGZ1bmN0aW9uKGRlc3QsIG9wdGlvbnMpIHtcbiAgdmFyIHNvdXJjZSA9IHRoaXM7XG5cbiAgZnVuY3Rpb24gb25kYXRhKGNodW5rKSB7XG4gICAgaWYgKGRlc3Qud3JpdGFibGUpIHtcbiAgICAgIGlmIChmYWxzZSA9PT0gZGVzdC53cml0ZShjaHVuaykgJiYgc291cmNlLnBhdXNlKSB7XG4gICAgICAgIHNvdXJjZS5wYXVzZSgpO1xuICAgICAgfVxuICAgIH1cbiAgfVxuXG4gIHNvdXJjZS5vbignZGF0YScsIG9uZGF0YSk7XG5cbiAgZnVuY3Rpb24gb25kcmFpbigpIHtcbiAgICBpZiAoc291cmNlLnJlYWRhYmxlICYmIHNvdXJjZS5yZXN1bWUpIHtcbiAgICAgIHNvdXJjZS5yZXN1bWUoKTtcbiAgICB9XG4gIH1cblxuICBkZXN0Lm9uKCdkcmFpbicsIG9uZHJhaW4pO1xuXG4gIC8vIElmIHRoZSAnZW5kJyBvcHRpb24gaXMgbm90IHN1cHBsaWVkLCBkZXN0LmVuZCgpIHdpbGwgYmUgY2FsbGVkIHdoZW5cbiAgLy8gc291cmNlIGdldHMgdGhlICdlbmQnIG9yICdjbG9zZScgZXZlbnRzLiAgT25seSBkZXN0LmVuZCgpIG9uY2UuXG4gIGlmICghZGVzdC5faXNTdGRpbyAmJiAoIW9wdGlvbnMgfHwgb3B0aW9ucy5lbmQgIT09IGZhbHNlKSkge1xuICAgIHNvdXJjZS5vbignZW5kJywgb25lbmQpO1xuICAgIHNvdXJjZS5vbignY2xvc2UnLCBvbmNsb3NlKTtcbiAgfVxuXG4gIHZhciBkaWRPbkVuZCA9IGZhbHNlO1xuICBmdW5jdGlvbiBvbmVuZCgpIHtcbiAgICBpZiAoZGlkT25FbmQpIHJldHVybjtcbiAgICBkaWRPbkVuZCA9IHRydWU7XG5cbiAgICBkZXN0LmVuZCgpO1xuICB9XG5cblxuICBmdW5jdGlvbiBvbmNsb3NlKCkge1xuICAgIGlmIChkaWRPbkVuZCkgcmV0dXJuO1xuICAgIGRpZE9uRW5kID0gdHJ1ZTtcblxuICAgIGlmICh0eXBlb2YgZGVzdC5kZXN0cm95ID09PSAnZnVuY3Rpb24nKSBkZXN0LmRlc3Ryb3koKTtcbiAgfVxuXG4gIC8vIGRvbid0IGxlYXZlIGRhbmdsaW5nIHBpcGVzIHdoZW4gdGhlcmUgYXJlIGVycm9ycy5cbiAgZnVuY3Rpb24gb25lcnJvcihlcikge1xuICAgIGNsZWFudXAoKTtcbiAgICBpZiAoRUUubGlzdGVuZXJDb3VudCh0aGlzLCAnZXJyb3InKSA9PT0gMCkge1xuICAgICAgdGhyb3cgZXI7IC8vIFVuaGFuZGxlZCBzdHJlYW0gZXJyb3IgaW4gcGlwZS5cbiAgICB9XG4gIH1cblxuICBzb3VyY2Uub24oJ2Vycm9yJywgb25lcnJvcik7XG4gIGRlc3Qub24oJ2Vycm9yJywgb25lcnJvcik7XG5cbiAgLy8gcmVtb3ZlIGFsbCB0aGUgZXZlbnQgbGlzdGVuZXJzIHRoYXQgd2VyZSBhZGRlZC5cbiAgZnVuY3Rpb24gY2xlYW51cCgpIHtcbiAgICBzb3VyY2UucmVtb3ZlTGlzdGVuZXIoJ2RhdGEnLCBvbmRhdGEpO1xuICAgIGRlc3QucmVtb3ZlTGlzdGVuZXIoJ2RyYWluJywgb25kcmFpbik7XG5cbiAgICBzb3VyY2UucmVtb3ZlTGlzdGVuZXIoJ2VuZCcsIG9uZW5kKTtcbiAgICBzb3VyY2UucmVtb3ZlTGlzdGVuZXIoJ2Nsb3NlJywgb25jbG9zZSk7XG5cbiAgICBzb3VyY2UucmVtb3ZlTGlzdGVuZXIoJ2Vycm9yJywgb25lcnJvcik7XG4gICAgZGVzdC5yZW1vdmVMaXN0ZW5lcignZXJyb3InLCBvbmVycm9yKTtcblxuICAgIHNvdXJjZS5yZW1vdmVMaXN0ZW5lcignZW5kJywgY2xlYW51cCk7XG4gICAgc291cmNlLnJlbW92ZUxpc3RlbmVyKCdjbG9zZScsIGNsZWFudXApO1xuXG4gICAgZGVzdC5yZW1vdmVMaXN0ZW5lcignY2xvc2UnLCBjbGVhbnVwKTtcbiAgfVxuXG4gIHNvdXJjZS5vbignZW5kJywgY2xlYW51cCk7XG4gIHNvdXJjZS5vbignY2xvc2UnLCBjbGVhbnVwKTtcblxuICBkZXN0Lm9uKCdjbG9zZScsIGNsZWFudXApO1xuXG4gIGRlc3QuZW1pdCgncGlwZScsIHNvdXJjZSk7XG5cbiAgLy8gQWxsb3cgZm9yIHVuaXgtbGlrZSB1c2FnZTogQS5waXBlKEIpLnBpcGUoQylcbiAgcmV0dXJuIGRlc3Q7XG59O1xuIiwiLy8gQ29weXJpZ2h0IEpveWVudCwgSW5jLiBhbmQgb3RoZXIgTm9kZSBjb250cmlidXRvcnMuXG4vL1xuLy8gUGVybWlzc2lvbiBpcyBoZXJlYnkgZ3JhbnRlZCwgZnJlZSBvZiBjaGFyZ2UsIHRvIGFueSBwZXJzb24gb2J0YWluaW5nIGFcbi8vIGNvcHkgb2YgdGhpcyBzb2Z0d2FyZSBhbmQgYXNzb2NpYXRlZCBkb2N1bWVudGF0aW9uIGZpbGVzICh0aGVcbi8vIFwiU29mdHdhcmVcIiksIHRvIGRlYWwgaW4gdGhlIFNvZnR3YXJlIHdpdGhvdXQgcmVzdHJpY3Rpb24sIGluY2x1ZGluZ1xuLy8gd2l0aG91dCBsaW1pdGF0aW9uIHRoZSByaWdodHMgdG8gdXNlLCBjb3B5LCBtb2RpZnksIG1lcmdlLCBwdWJsaXNoLFxuLy8gZGlzdHJpYnV0ZSwgc3VibGljZW5zZSwgYW5kL29yIHNlbGwgY29waWVzIG9mIHRoZSBTb2Z0d2FyZSwgYW5kIHRvIHBlcm1pdFxuLy8gcGVyc29ucyB0byB3aG9tIHRoZSBTb2Z0d2FyZSBpcyBmdXJuaXNoZWQgdG8gZG8gc28sIHN1YmplY3QgdG8gdGhlXG4vLyBmb2xsb3dpbmcgY29uZGl0aW9uczpcbi8vXG4vLyBUaGUgYWJvdmUgY29weXJpZ2h0IG5vdGljZSBhbmQgdGhpcyBwZXJtaXNzaW9uIG5vdGljZSBzaGFsbCBiZSBpbmNsdWRlZFxuLy8gaW4gYWxsIGNvcGllcyBvciBzdWJzdGFudGlhbCBwb3J0aW9ucyBvZiB0aGUgU29mdHdhcmUuXG4vL1xuLy8gVEhFIFNPRlRXQVJFIElTIFBST1ZJREVEIFwiQVMgSVNcIiwgV0lUSE9VVCBXQVJSQU5UWSBPRiBBTlkgS0lORCwgRVhQUkVTU1xuLy8gT1IgSU1QTElFRCwgSU5DTFVESU5HIEJVVCBOT1QgTElNSVRFRCBUTyBUSEUgV0FSUkFOVElFUyBPRlxuLy8gTUVSQ0hBTlRBQklMSVRZLCBGSVRORVNTIEZPUiBBIFBBUlRJQ1VMQVIgUFVSUE9TRSBBTkQgTk9OSU5GUklOR0VNRU5ULiBJTlxuLy8gTk8gRVZFTlQgU0hBTEwgVEhFIEFVVEhPUlMgT1IgQ09QWVJJR0hUIEhPTERFUlMgQkUgTElBQkxFIEZPUiBBTlkgQ0xBSU0sXG4vLyBEQU1BR0VTIE9SIE9USEVSIExJQUJJTElUWSwgV0hFVEhFUiBJTiBBTiBBQ1RJT04gT0YgQ09OVFJBQ1QsIFRPUlQgT1Jcbi8vIE9USEVSV0lTRSwgQVJJU0lORyBGUk9NLCBPVVQgT0YgT1IgSU4gQ09OTkVDVElPTiBXSVRIIFRIRSBTT0ZUV0FSRSBPUiBUSEVcbi8vIFVTRSBPUiBPVEhFUiBERUFMSU5HUyBJTiBUSEUgU09GVFdBUkUuXG5cbnZhciBCdWZmZXIgPSByZXF1aXJlKCdidWZmZXInKS5CdWZmZXI7XG5cbnZhciBpc0J1ZmZlckVuY29kaW5nID0gQnVmZmVyLmlzRW5jb2RpbmdcbiAgfHwgZnVuY3Rpb24oZW5jb2RpbmcpIHtcbiAgICAgICBzd2l0Y2ggKGVuY29kaW5nICYmIGVuY29kaW5nLnRvTG93ZXJDYXNlKCkpIHtcbiAgICAgICAgIGNhc2UgJ2hleCc6IGNhc2UgJ3V0ZjgnOiBjYXNlICd1dGYtOCc6IGNhc2UgJ2FzY2lpJzogY2FzZSAnYmluYXJ5JzogY2FzZSAnYmFzZTY0JzogY2FzZSAndWNzMic6IGNhc2UgJ3Vjcy0yJzogY2FzZSAndXRmMTZsZSc6IGNhc2UgJ3V0Zi0xNmxlJzogY2FzZSAncmF3JzogcmV0dXJuIHRydWU7XG4gICAgICAgICBkZWZhdWx0OiByZXR1cm4gZmFsc2U7XG4gICAgICAgfVxuICAgICB9XG5cblxuZnVuY3Rpb24gYXNzZXJ0RW5jb2RpbmcoZW5jb2RpbmcpIHtcbiAgaWYgKGVuY29kaW5nICYmICFpc0J1ZmZlckVuY29kaW5nKGVuY29kaW5nKSkge1xuICAgIHRocm93IG5ldyBFcnJvcignVW5rbm93biBlbmNvZGluZzogJyArIGVuY29kaW5nKTtcbiAgfVxufVxuXG4vLyBTdHJpbmdEZWNvZGVyIHByb3ZpZGVzIGFuIGludGVyZmFjZSBmb3IgZWZmaWNpZW50bHkgc3BsaXR0aW5nIGEgc2VyaWVzIG9mXG4vLyBidWZmZXJzIGludG8gYSBzZXJpZXMgb2YgSlMgc3RyaW5ncyB3aXRob3V0IGJyZWFraW5nIGFwYXJ0IG11bHRpLWJ5dGVcbi8vIGNoYXJhY3RlcnMuIENFU1UtOCBpcyBoYW5kbGVkIGFzIHBhcnQgb2YgdGhlIFVURi04IGVuY29kaW5nLlxuLy9cbi8vIEBUT0RPIEhhbmRsaW5nIGFsbCBlbmNvZGluZ3MgaW5zaWRlIGEgc2luZ2xlIG9iamVjdCBtYWtlcyBpdCB2ZXJ5IGRpZmZpY3VsdFxuLy8gdG8gcmVhc29uIGFib3V0IHRoaXMgY29kZSwgc28gaXQgc2hvdWxkIGJlIHNwbGl0IHVwIGluIHRoZSBmdXR1cmUuXG4vLyBAVE9ETyBUaGVyZSBzaG91bGQgYmUgYSB1dGY4LXN0cmljdCBlbmNvZGluZyB0aGF0IHJlamVjdHMgaW52YWxpZCBVVEYtOCBjb2RlXG4vLyBwb2ludHMgYXMgdXNlZCBieSBDRVNVLTguXG52YXIgU3RyaW5nRGVjb2RlciA9IGV4cG9ydHMuU3RyaW5nRGVjb2RlciA9IGZ1bmN0aW9uKGVuY29kaW5nKSB7XG4gIHRoaXMuZW5jb2RpbmcgPSAoZW5jb2RpbmcgfHwgJ3V0ZjgnKS50b0xvd2VyQ2FzZSgpLnJlcGxhY2UoL1stX10vLCAnJyk7XG4gIGFzc2VydEVuY29kaW5nKGVuY29kaW5nKTtcbiAgc3dpdGNoICh0aGlzLmVuY29kaW5nKSB7XG4gICAgY2FzZSAndXRmOCc6XG4gICAgICAvLyBDRVNVLTggcmVwcmVzZW50cyBlYWNoIG9mIFN1cnJvZ2F0ZSBQYWlyIGJ5IDMtYnl0ZXNcbiAgICAgIHRoaXMuc3Vycm9nYXRlU2l6ZSA9IDM7XG4gICAgICBicmVhaztcbiAgICBjYXNlICd1Y3MyJzpcbiAgICBjYXNlICd1dGYxNmxlJzpcbiAgICAgIC8vIFVURi0xNiByZXByZXNlbnRzIGVhY2ggb2YgU3Vycm9nYXRlIFBhaXIgYnkgMi1ieXRlc1xuICAgICAgdGhpcy5zdXJyb2dhdGVTaXplID0gMjtcbiAgICAgIHRoaXMuZGV0ZWN0SW5jb21wbGV0ZUNoYXIgPSB1dGYxNkRldGVjdEluY29tcGxldGVDaGFyO1xuICAgICAgYnJlYWs7XG4gICAgY2FzZSAnYmFzZTY0JzpcbiAgICAgIC8vIEJhc2UtNjQgc3RvcmVzIDMgYnl0ZXMgaW4gNCBjaGFycywgYW5kIHBhZHMgdGhlIHJlbWFpbmRlci5cbiAgICAgIHRoaXMuc3Vycm9nYXRlU2l6ZSA9IDM7XG4gICAgICB0aGlzLmRldGVjdEluY29tcGxldGVDaGFyID0gYmFzZTY0RGV0ZWN0SW5jb21wbGV0ZUNoYXI7XG4gICAgICBicmVhaztcbiAgICBkZWZhdWx0OlxuICAgICAgdGhpcy53cml0ZSA9IHBhc3NUaHJvdWdoV3JpdGU7XG4gICAgICByZXR1cm47XG4gIH1cblxuICAvLyBFbm91Z2ggc3BhY2UgdG8gc3RvcmUgYWxsIGJ5dGVzIG9mIGEgc2luZ2xlIGNoYXJhY3Rlci4gVVRGLTggbmVlZHMgNFxuICAvLyBieXRlcywgYnV0IENFU1UtOCBtYXkgcmVxdWlyZSB1cCB0byA2ICgzIGJ5dGVzIHBlciBzdXJyb2dhdGUpLlxuICB0aGlzLmNoYXJCdWZmZXIgPSBuZXcgQnVmZmVyKDYpO1xuICAvLyBOdW1iZXIgb2YgYnl0ZXMgcmVjZWl2ZWQgZm9yIHRoZSBjdXJyZW50IGluY29tcGxldGUgbXVsdGktYnl0ZSBjaGFyYWN0ZXIuXG4gIHRoaXMuY2hhclJlY2VpdmVkID0gMDtcbiAgLy8gTnVtYmVyIG9mIGJ5dGVzIGV4cGVjdGVkIGZvciB0aGUgY3VycmVudCBpbmNvbXBsZXRlIG11bHRpLWJ5dGUgY2hhcmFjdGVyLlxuICB0aGlzLmNoYXJMZW5ndGggPSAwO1xufTtcblxuXG4vLyB3cml0ZSBkZWNvZGVzIHRoZSBnaXZlbiBidWZmZXIgYW5kIHJldHVybnMgaXQgYXMgSlMgc3RyaW5nIHRoYXQgaXNcbi8vIGd1YXJhbnRlZWQgdG8gbm90IGNvbnRhaW4gYW55IHBhcnRpYWwgbXVsdGktYnl0ZSBjaGFyYWN0ZXJzLiBBbnkgcGFydGlhbFxuLy8gY2hhcmFjdGVyIGZvdW5kIGF0IHRoZSBlbmQgb2YgdGhlIGJ1ZmZlciBpcyBidWZmZXJlZCB1cCwgYW5kIHdpbGwgYmVcbi8vIHJldHVybmVkIHdoZW4gY2FsbGluZyB3cml0ZSBhZ2FpbiB3aXRoIHRoZSByZW1haW5pbmcgYnl0ZXMuXG4vL1xuLy8gTm90ZTogQ29udmVydGluZyBhIEJ1ZmZlciBjb250YWluaW5nIGFuIG9ycGhhbiBzdXJyb2dhdGUgdG8gYSBTdHJpbmdcbi8vIGN1cnJlbnRseSB3b3JrcywgYnV0IGNvbnZlcnRpbmcgYSBTdHJpbmcgdG8gYSBCdWZmZXIgKHZpYSBgbmV3IEJ1ZmZlcmAsIG9yXG4vLyBCdWZmZXIjd3JpdGUpIHdpbGwgcmVwbGFjZSBpbmNvbXBsZXRlIHN1cnJvZ2F0ZXMgd2l0aCB0aGUgdW5pY29kZVxuLy8gcmVwbGFjZW1lbnQgY2hhcmFjdGVyLiBTZWUgaHR0cHM6Ly9jb2RlcmV2aWV3LmNocm9taXVtLm9yZy8xMjExNzMwMDkvIC5cblN0cmluZ0RlY29kZXIucHJvdG90eXBlLndyaXRlID0gZnVuY3Rpb24oYnVmZmVyKSB7XG4gIHZhciBjaGFyU3RyID0gJyc7XG4gIC8vIGlmIG91ciBsYXN0IHdyaXRlIGVuZGVkIHdpdGggYW4gaW5jb21wbGV0ZSBtdWx0aWJ5dGUgY2hhcmFjdGVyXG4gIHdoaWxlICh0aGlzLmNoYXJMZW5ndGgpIHtcbiAgICAvLyBkZXRlcm1pbmUgaG93IG1hbnkgcmVtYWluaW5nIGJ5dGVzIHRoaXMgYnVmZmVyIGhhcyB0byBvZmZlciBmb3IgdGhpcyBjaGFyXG4gICAgdmFyIGF2YWlsYWJsZSA9IChidWZmZXIubGVuZ3RoID49IHRoaXMuY2hhckxlbmd0aCAtIHRoaXMuY2hhclJlY2VpdmVkKSA/XG4gICAgICAgIHRoaXMuY2hhckxlbmd0aCAtIHRoaXMuY2hhclJlY2VpdmVkIDpcbiAgICAgICAgYnVmZmVyLmxlbmd0aDtcblxuICAgIC8vIGFkZCB0aGUgbmV3IGJ5dGVzIHRvIHRoZSBjaGFyIGJ1ZmZlclxuICAgIGJ1ZmZlci5jb3B5KHRoaXMuY2hhckJ1ZmZlciwgdGhpcy5jaGFyUmVjZWl2ZWQsIDAsIGF2YWlsYWJsZSk7XG4gICAgdGhpcy5jaGFyUmVjZWl2ZWQgKz0gYXZhaWxhYmxlO1xuXG4gICAgaWYgKHRoaXMuY2hhclJlY2VpdmVkIDwgdGhpcy5jaGFyTGVuZ3RoKSB7XG4gICAgICAvLyBzdGlsbCBub3QgZW5vdWdoIGNoYXJzIGluIHRoaXMgYnVmZmVyPyB3YWl0IGZvciBtb3JlIC4uLlxuICAgICAgcmV0dXJuICcnO1xuICAgIH1cblxuICAgIC8vIHJlbW92ZSBieXRlcyBiZWxvbmdpbmcgdG8gdGhlIGN1cnJlbnQgY2hhcmFjdGVyIGZyb20gdGhlIGJ1ZmZlclxuICAgIGJ1ZmZlciA9IGJ1ZmZlci5zbGljZShhdmFpbGFibGUsIGJ1ZmZlci5sZW5ndGgpO1xuXG4gICAgLy8gZ2V0IHRoZSBjaGFyYWN0ZXIgdGhhdCB3YXMgc3BsaXRcbiAgICBjaGFyU3RyID0gdGhpcy5jaGFyQnVmZmVyLnNsaWNlKDAsIHRoaXMuY2hhckxlbmd0aCkudG9TdHJpbmcodGhpcy5lbmNvZGluZyk7XG5cbiAgICAvLyBDRVNVLTg6IGxlYWQgc3Vycm9nYXRlIChEODAwLURCRkYpIGlzIGFsc28gdGhlIGluY29tcGxldGUgY2hhcmFjdGVyXG4gICAgdmFyIGNoYXJDb2RlID0gY2hhclN0ci5jaGFyQ29kZUF0KGNoYXJTdHIubGVuZ3RoIC0gMSk7XG4gICAgaWYgKGNoYXJDb2RlID49IDB4RDgwMCAmJiBjaGFyQ29kZSA8PSAweERCRkYpIHtcbiAgICAgIHRoaXMuY2hhckxlbmd0aCArPSB0aGlzLnN1cnJvZ2F0ZVNpemU7XG4gICAgICBjaGFyU3RyID0gJyc7XG4gICAgICBjb250aW51ZTtcbiAgICB9XG4gICAgdGhpcy5jaGFyUmVjZWl2ZWQgPSB0aGlzLmNoYXJMZW5ndGggPSAwO1xuXG4gICAgLy8gaWYgdGhlcmUgYXJlIG5vIG1vcmUgYnl0ZXMgaW4gdGhpcyBidWZmZXIsIGp1c3QgZW1pdCBvdXIgY2hhclxuICAgIGlmIChidWZmZXIubGVuZ3RoID09PSAwKSB7XG4gICAgICByZXR1cm4gY2hhclN0cjtcbiAgICB9XG4gICAgYnJlYWs7XG4gIH1cblxuICAvLyBkZXRlcm1pbmUgYW5kIHNldCBjaGFyTGVuZ3RoIC8gY2hhclJlY2VpdmVkXG4gIHRoaXMuZGV0ZWN0SW5jb21wbGV0ZUNoYXIoYnVmZmVyKTtcblxuICB2YXIgZW5kID0gYnVmZmVyLmxlbmd0aDtcbiAgaWYgKHRoaXMuY2hhckxlbmd0aCkge1xuICAgIC8vIGJ1ZmZlciB0aGUgaW5jb21wbGV0ZSBjaGFyYWN0ZXIgYnl0ZXMgd2UgZ290XG4gICAgYnVmZmVyLmNvcHkodGhpcy5jaGFyQnVmZmVyLCAwLCBidWZmZXIubGVuZ3RoIC0gdGhpcy5jaGFyUmVjZWl2ZWQsIGVuZCk7XG4gICAgZW5kIC09IHRoaXMuY2hhclJlY2VpdmVkO1xuICB9XG5cbiAgY2hhclN0ciArPSBidWZmZXIudG9TdHJpbmcodGhpcy5lbmNvZGluZywgMCwgZW5kKTtcblxuICB2YXIgZW5kID0gY2hhclN0ci5sZW5ndGggLSAxO1xuICB2YXIgY2hhckNvZGUgPSBjaGFyU3RyLmNoYXJDb2RlQXQoZW5kKTtcbiAgLy8gQ0VTVS04OiBsZWFkIHN1cnJvZ2F0ZSAoRDgwMC1EQkZGKSBpcyBhbHNvIHRoZSBpbmNvbXBsZXRlIGNoYXJhY3RlclxuICBpZiAoY2hhckNvZGUgPj0gMHhEODAwICYmIGNoYXJDb2RlIDw9IDB4REJGRikge1xuICAgIHZhciBzaXplID0gdGhpcy5zdXJyb2dhdGVTaXplO1xuICAgIHRoaXMuY2hhckxlbmd0aCArPSBzaXplO1xuICAgIHRoaXMuY2hhclJlY2VpdmVkICs9IHNpemU7XG4gICAgdGhpcy5jaGFyQnVmZmVyLmNvcHkodGhpcy5jaGFyQnVmZmVyLCBzaXplLCAwLCBzaXplKTtcbiAgICBidWZmZXIuY29weSh0aGlzLmNoYXJCdWZmZXIsIDAsIDAsIHNpemUpO1xuICAgIHJldHVybiBjaGFyU3RyLnN1YnN0cmluZygwLCBlbmQpO1xuICB9XG5cbiAgLy8gb3IganVzdCBlbWl0IHRoZSBjaGFyU3RyXG4gIHJldHVybiBjaGFyU3RyO1xufTtcblxuLy8gZGV0ZWN0SW5jb21wbGV0ZUNoYXIgZGV0ZXJtaW5lcyBpZiB0aGVyZSBpcyBhbiBpbmNvbXBsZXRlIFVURi04IGNoYXJhY3RlciBhdFxuLy8gdGhlIGVuZCBvZiB0aGUgZ2l2ZW4gYnVmZmVyLiBJZiBzbywgaXQgc2V0cyB0aGlzLmNoYXJMZW5ndGggdG8gdGhlIGJ5dGVcbi8vIGxlbmd0aCB0aGF0IGNoYXJhY3RlciwgYW5kIHNldHMgdGhpcy5jaGFyUmVjZWl2ZWQgdG8gdGhlIG51bWJlciBvZiBieXRlc1xuLy8gdGhhdCBhcmUgYXZhaWxhYmxlIGZvciB0aGlzIGNoYXJhY3Rlci5cblN0cmluZ0RlY29kZXIucHJvdG90eXBlLmRldGVjdEluY29tcGxldGVDaGFyID0gZnVuY3Rpb24oYnVmZmVyKSB7XG4gIC8vIGRldGVybWluZSBob3cgbWFueSBieXRlcyB3ZSBoYXZlIHRvIGNoZWNrIGF0IHRoZSBlbmQgb2YgdGhpcyBidWZmZXJcbiAgdmFyIGkgPSAoYnVmZmVyLmxlbmd0aCA+PSAzKSA/IDMgOiBidWZmZXIubGVuZ3RoO1xuXG4gIC8vIEZpZ3VyZSBvdXQgaWYgb25lIG9mIHRoZSBsYXN0IGkgYnl0ZXMgb2Ygb3VyIGJ1ZmZlciBhbm5vdW5jZXMgYW5cbiAgLy8gaW5jb21wbGV0ZSBjaGFyLlxuICBmb3IgKDsgaSA+IDA7IGktLSkge1xuICAgIHZhciBjID0gYnVmZmVyW2J1ZmZlci5sZW5ndGggLSBpXTtcblxuICAgIC8vIFNlZSBodHRwOi8vZW4ud2lraXBlZGlhLm9yZy93aWtpL1VURi04I0Rlc2NyaXB0aW9uXG5cbiAgICAvLyAxMTBYWFhYWFxuICAgIGlmIChpID09IDEgJiYgYyA+PiA1ID09IDB4MDYpIHtcbiAgICAgIHRoaXMuY2hhckxlbmd0aCA9IDI7XG4gICAgICBicmVhaztcbiAgICB9XG5cbiAgICAvLyAxMTEwWFhYWFxuICAgIGlmIChpIDw9IDIgJiYgYyA+PiA0ID09IDB4MEUpIHtcbiAgICAgIHRoaXMuY2hhckxlbmd0aCA9IDM7XG4gICAgICBicmVhaztcbiAgICB9XG5cbiAgICAvLyAxMTExMFhYWFxuICAgIGlmIChpIDw9IDMgJiYgYyA+PiAzID09IDB4MUUpIHtcbiAgICAgIHRoaXMuY2hhckxlbmd0aCA9IDQ7XG4gICAgICBicmVhaztcbiAgICB9XG4gIH1cbiAgdGhpcy5jaGFyUmVjZWl2ZWQgPSBpO1xufTtcblxuU3RyaW5nRGVjb2Rlci5wcm90b3R5cGUuZW5kID0gZnVuY3Rpb24oYnVmZmVyKSB7XG4gIHZhciByZXMgPSAnJztcbiAgaWYgKGJ1ZmZlciAmJiBidWZmZXIubGVuZ3RoKVxuICAgIHJlcyA9IHRoaXMud3JpdGUoYnVmZmVyKTtcblxuICBpZiAodGhpcy5jaGFyUmVjZWl2ZWQpIHtcbiAgICB2YXIgY3IgPSB0aGlzLmNoYXJSZWNlaXZlZDtcbiAgICB2YXIgYnVmID0gdGhpcy5jaGFyQnVmZmVyO1xuICAgIHZhciBlbmMgPSB0aGlzLmVuY29kaW5nO1xuICAgIHJlcyArPSBidWYuc2xpY2UoMCwgY3IpLnRvU3RyaW5nKGVuYyk7XG4gIH1cblxuICByZXR1cm4gcmVzO1xufTtcblxuZnVuY3Rpb24gcGFzc1Rocm91Z2hXcml0ZShidWZmZXIpIHtcbiAgcmV0dXJuIGJ1ZmZlci50b1N0cmluZyh0aGlzLmVuY29kaW5nKTtcbn1cblxuZnVuY3Rpb24gdXRmMTZEZXRlY3RJbmNvbXBsZXRlQ2hhcihidWZmZXIpIHtcbiAgdGhpcy5jaGFyUmVjZWl2ZWQgPSBidWZmZXIubGVuZ3RoICUgMjtcbiAgdGhpcy5jaGFyTGVuZ3RoID0gdGhpcy5jaGFyUmVjZWl2ZWQgPyAyIDogMDtcbn1cblxuZnVuY3Rpb24gYmFzZTY0RGV0ZWN0SW5jb21wbGV0ZUNoYXIoYnVmZmVyKSB7XG4gIHRoaXMuY2hhclJlY2VpdmVkID0gYnVmZmVyLmxlbmd0aCAlIDM7XG4gIHRoaXMuY2hhckxlbmd0aCA9IHRoaXMuY2hhclJlY2VpdmVkID8gMyA6IDA7XG59XG4iLCJ2YXIgdGVzdCA9IHJlcXVpcmUoJ3RhcGUnKSxcbiAgICBkcml2ZXIgPSByZXF1aXJlKCdhdXRvbWFnaWMtdWknKSxcbiAgICBjcmVhdGVUaW1lUGlja2VyID0gcmVxdWlyZSgnLi4vLi4vJyksXG4gICAgZmFzdG4gPSByZXF1aXJlKCdmYXN0bicpKHtcbiAgICAgICAgX2dlbmVyaWM6IHJlcXVpcmUoJ2Zhc3RuL2dlbmVyaWNDb21wb25lbnQnKSxcbiAgICAgICAgdGV4dDogcmVxdWlyZSgnZmFzdG4vdGV4dENvbXBvbmVudCcpXG4gICAgfSksXG4gICAgbW9kZWwgPSB7fTtcblxud2luZG93Lm9ubG9hZCA9IGZ1bmN0aW9uKCkge1xuICAgIHZhciB0aW1lUGlja2VyID0gY3JlYXRlVGltZVBpY2tlcigpLFxuICAgICAgICB0aW1lQmluZGluZyA9IGZhc3RuLmJpbmRpbmcoJ3RpbWV8KicsIGZ1bmN0aW9uKHRpbWUpe1xuICAgICAgICAgICAgcmV0dXJuIHRpbWUgPyAnVGltZSBpcyBzZXQgdG8gJyArIHRpbWUgOiAnJztcbiAgICAgICAgfSkuYXR0YWNoKG1vZGVsKSxcbiAgICAgICAgdGltZUxhYmVsID0gZmFzdG4oJ2xhYmVsJywgdGltZUJpbmRpbmcpO1xuXG4gICAgdGltZUxhYmVsLmF0dGFjaChtb2RlbCkucmVuZGVyKCk7XG5cbiAgICBkb2N1bWVudC5ib2R5LmFwcGVuZENoaWxkKHRpbWVQaWNrZXIuZWxlbWVudCk7XG4gICAgZG9jdW1lbnQuYm9keS5hcHBlbmRDaGlsZCh0aW1lTGFiZWwuZWxlbWVudCk7XG5cbiAgICB0aW1lUGlja2VyLnRpbWUub24oJ2NoYW5nZScsIGZ1bmN0aW9uKHRpbWUpe1xuICAgICAgICBmYXN0bi5Nb2RlbC5zdG9yZShtb2RlbCwgJ3RpbWUnLCB0aW1lKTtcbiAgICB9KTtcblxuICAgIGRyaXZlci5pbml0KHtcbiAgICAgICAgcnVuRGVsYXk6IDIwMDBcbiAgICB9KTtcblxuICAgIHRlc3QoJ3RpbWVwaWNrZXIgZWxlbWVudHMgYXJlIGluIHZpZXcnLCBmdW5jdGlvbih0KXtcbiAgICAgICAgdC5wbGFuKDEpO1xuXG4gICAgICAgIGRyaXZlcigpXG4gICAgICAgICAgICAuZmluZFVpKCdob3VycycsICdmaWVsZCcpXG4gICAgICAgICAgICAuZmluZFVpKCdtaW51dGVzJywgJ2ZpZWxkJylcbiAgICAgICAgICAgIC5maW5kVWkoJ3NlY29uZHMnLCAnZmllbGQnKVxuICAgICAgICAgICAgLmZpbmRVaSgnbWVyaWRpZW0nLCAnZmllbGQnKVxuICAgICAgICAgICAgLmdvKGZ1bmN0aW9uKGVycm9yLCByZXN1bHQpe1xuICAgICAgICAgICAgICAgIHQub2socmVzdWx0LCAnZm91bmQgdGltZXBpY2tlciBlbGVtZW50cycpO1xuICAgICAgICAgICAgfSk7XG4gICAgfSk7XG5cbiAgICB0ZXN0KCdzdGF0ZScsIGZ1bmN0aW9uKHQpIHtcbiAgICAgICAgdC5wbGFuKDMpO1xuXG4gICAgICAgIGRyaXZlcigpXG4gICAgICAgICAgICAuY2hhbmdlVmFsdWUoJ2hvdXJzJywgJ2ZpZWxkJywgJzEwJylcbiAgICAgICAgICAgIC5jaGFuZ2VWYWx1ZSgnbWludXRlcycsICdmaWVsZCcsICcxMCcpXG4gICAgICAgICAgICAuY2hhbmdlVmFsdWUoJ3NlY29uZHMnLCAnZmllbGQnLCAnMTAnKVxuICAgICAgICAgICAgLmdvKGZ1bmN0aW9uKGVycm9yLCByZXN1bHQpIHtcbiAgICAgICAgICAgICAgICBpZihlcnJvcikge1xuICAgICAgICAgICAgICAgICAgICBjb25zb2xlLmxvZyhlcnJvcik7XG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgdC5lcXVhbCh0aW1lUGlja2VyLmhvdXJzKCksIDEwLCAnaG91cnMgc2V0IGNvcnJlY3RseScpO1xuICAgICAgICAgICAgICAgIHQuZXF1YWwodGltZVBpY2tlci5taW51dGVzKCksIDEwLCAnbWludXRlcyBzZXQgY29ycmVjdGx5Jyk7XG4gICAgICAgICAgICAgICAgdC5lcXVhbCh0aW1lUGlja2VyLnNlY29uZHMoKSwgMTAsICdzZWNvbmRzIHNldCBjb3JyZWN0bHknKTtcbiAgICAgICAgICAgIH0pO1xuICAgIH0pO1xuXG59O1xuIiwidmFyIGRvYyA9IHJlcXVpcmUoJ2RvYy1qcycpLFxuICAgIGNyZWwgPSByZXF1aXJlKCdjcmVsJyksXG4gICAgbW9ycmlzb24gPSByZXF1aXJlKCdtb3JyaXNvbicpLFxuICAgIGhvdXJzUmVnZXggPSAvXlsxLTldJHxeMFsxLTldJHxeMVswLTJdJC8sXG4gICAgbWludXRlc1NlY29uZHNSZWdleCA9IC9eWzAtNV1bMC05XSR8XlswLTldJC8sXG4gICAgbWVyaWRpZW1SZWdleCA9IC9eYW0kfF5wbSR8XkFNJHxeUE0kLyxcbiAgICB0aW1lUmVnZXggPSAvKDBbMS05XXwxWzAtMl0pOihbMC01XVswLTldKTooWzAtNV1bMC05XSkgKEFNfFBNKS87XG5cbmZ1bmN0aW9uIHByb3BlcnR5U2V0KHZhbHVlKSB7XG4gICAgcmV0dXJuIHZhbHVlID49IDAgJiYgdmFsdWUgIT09ICcnICYmIHZhbHVlICE9IG51bGw7XG59XG5cbmZ1bmN0aW9uIGludFRvU3RyaW5nKHZhbHVlKXtcbiAgICB2YXIgcmVzdWx0ID0gdmFsdWUudG9TdHJpbmcoKTtcbiAgICByZXN1bHQgPSByZXN1bHQubGVuZ3RoID09PSAxID8gJzAnICsgcmVzdWx0IDogcmVzdWx0O1xuXG4gICAgcmV0dXJuIHJlc3VsdDtcbn1cblxuXG5mdW5jdGlvbiB2YWx1ZUNoYW5nZShjb21wb25lbnQpIHtcbiAgICBpZighY29tcG9uZW50LmVsZW1lbnQpe1xuICAgICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgaWYoIWNvbXBvbmVudC5zZWNvbmRzRW5hYmxlZCgpKSB7XG4gICAgICAgIGNvbXBvbmVudC5zZWNvbmRzKDApO1xuICAgIH1cblxuICAgIGlmKCFjb21wb25lbnQubWludXRlc0VuYWJsZWQoKSkge1xuICAgICAgICBjb21wb25lbnQubWludXRlcygwKTtcbiAgICB9XG5cbiAgICB2YXIgaG91cnMgPSBjb21wb25lbnQuaG91cnMoKSxcbiAgICAgICAgbWludXRlcyA9IGNvbXBvbmVudC5taW51dGVzKCksXG4gICAgICAgIHNlY29uZHMgPSBjb21wb25lbnQuc2Vjb25kcygpLFxuICAgICAgICBtZXJpZGllbSA9IGNvbXBvbmVudC5tZXJpZGllbSgpLFxuICAgICAgICB0aW1lID0gJyc7XG5cbiAgICBpZighcHJvcGVydHlTZXQoaG91cnMpIHx8ICFwcm9wZXJ0eVNldChtaW51dGVzKSB8fCAhcHJvcGVydHlTZXQoc2Vjb25kcykgfHwgIW1lcmlkaWVtKSB7XG4gICAgICAgIGNvbXBvbmVudC52YWxpZChmYWxzZSk7XG4gICAgICAgIHJldHVybjtcbiAgICB9IGVsc2Uge1xuICAgICAgICBjb21wb25lbnQudmFsaWQodHJ1ZSk7XG4gICAgICAgIHRpbWUgPSBpbnRUb1N0cmluZyhob3VycykgKyAnOicgKyBpbnRUb1N0cmluZyhtaW51dGVzKSArICc6JyArIGludFRvU3RyaW5nKHNlY29uZHMpICsgJyAnICsgbWVyaWRpZW07XG4gICAgfVxuXG4gICAgY29tcG9uZW50LnRpbWUodGltZSk7XG4gICAgY29tcG9uZW50LmhvdXJzSW5wdXQudmFsdWUgPSBob3VycztcbiAgICBjb21wb25lbnQubWludXRlc0lucHV0LnZhbHVlID0gbWludXRlcztcbiAgICBjb21wb25lbnQuc2Vjb25kc0lucHV0LnZhbHVlID0gc2Vjb25kcztcbiAgICBjb21wb25lbnQubWVyaWRpZW1JbnB1dC52YWx1ZSA9IG1lcmlkaWVtO1xufVxuXG5tb2R1bGUuZXhwb3J0cyA9IGZ1bmN0aW9uKGZhc3RuLCBjb21wb25lbnQsIHR5cGUsIHNldHRpbmdzLCBjaGlsZHJlbil7XG4gICAgY29tcG9uZW50LmV4dGVuZCgnX2dlbmVyaWMnLCBzZXR0aW5ncywgY2hpbGRyZW4pO1xuICAgIGNvbXBvbmVudC5zZXRQcm9wZXJ0eSgndmFsaWQnKTtcblxuICAgIGNvbXBvbmVudC5zZXRQcm9wZXJ0eSgnbWludXRlc0VuYWJsZWQnKTtcbiAgICBjb21wb25lbnQubWludXRlc0VuYWJsZWQoc2V0dGluZ3MubWludXRlc0VuYWJsZWQgPT09IGZhbHNlID8gZmFsc2U6IHRydWUpO1xuICAgIGNvbXBvbmVudC5zZXRQcm9wZXJ0eSgnc2Vjb25kc0VuYWJsZWQnKTtcbiAgICBjb21wb25lbnQuc2Vjb25kc0VuYWJsZWQoc2V0dGluZ3Muc2Vjb25kc0VuYWJsZWQgPT09IGZhbHNlID8gZmFsc2U6IHRydWUpO1xuXG4gICAgZnVuY3Rpb24gc2V0SW5wdXRQcm9wZXJ0eShrZXksIGlucHV0LCByZWdleCl7XG4gICAgICAgIGNvbXBvbmVudC5zZXRQcm9wZXJ0eShrZXksIGZhc3RuLnByb3BlcnR5KG51bGwsIGZ1bmN0aW9uKHZhbHVlKSB7XG4gICAgICAgICAgICB2YXIgdmFsaWRWYWx1ZSA9IHJlZ2V4LnRlc3QodmFsdWUpO1xuICAgICAgICAgICAgaW5wdXQudmFsdWUgPSB2YWxpZFZhbHVlID8gdmFsdWUgOiAnJztcbiAgICAgICAgICAgIGlmKCF2YWxpZFZhbHVlKSB7XG4gICAgICAgICAgICAgICAgY29tcG9uZW50W2tleV0obnVsbCk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICB2YWx1ZUNoYW5nZShjb21wb25lbnQpO1xuICAgICAgICB9KSk7XG4gICAgfVxuXG4gICAgY29tcG9uZW50LmhvdXJzSW5wdXQgPSBjcmVsKCdpbnB1dCcse1xuICAgICAgICBjbGFzczogJ2hvdXJzJyxcbiAgICAgICAgdGl0bGU6ICdob3VycycsXG4gICAgICAgIHBsYWNlaG9sZGVyOiAnaGgnXG4gICAgfSk7XG5cbiAgICBjb21wb25lbnQubWludXRlc0lucHV0ID0gY3JlbCgnaW5wdXQnLCB7XG4gICAgICAgIGNsYXNzOiAnbWludXRlcycsXG4gICAgICAgIHRpdGxlOiAnbWludXRlcycsXG4gICAgICAgIHBsYWNlaG9sZGVyOiAnbW0nXG4gICAgfSk7XG5cbiAgICBjb21wb25lbnQuc2Vjb25kc0lucHV0ID0gY3JlbCgnaW5wdXQnLCB7XG4gICAgICAgIGNsYXNzOiAnc2Vjb25kcycsXG4gICAgICAgIHRpdGxlOiAnc2Vjb25kcycsXG4gICAgICAgIHBsYWNlaG9sZGVyOiAnc3MnXG4gICAgfSk7XG5cbiAgICBjb21wb25lbnQubWVyaWRpZW1JbnB1dCA9IGNyZWwoJ3NlbGVjdCcsIHtcbiAgICAgICAgICAgIGNsYXNzOiAnbWVyaWRpZW0nLFxuICAgICAgICAgICAgdGl0bGU6ICdtZXJpZGllbSdcbiAgICAgICAgfSxcbiAgICAgICAgY3JlbCgnb3B0aW9uJywge3ZhbHVlOiAnQU0nfSwgJ0FNJyksXG4gICAgICAgIGNyZWwoJ29wdGlvbicsIHt2YWx1ZTogJ1BNJ30sICdQTScpXG4gICAgKTtcblxuICAgIHNldElucHV0UHJvcGVydHkoJ2hvdXJzJywgY29tcG9uZW50LmhvdXJzSW5wdXQsIGhvdXJzUmVnZXgpO1xuICAgIHNldElucHV0UHJvcGVydHkoJ21pbnV0ZXMnLCBjb21wb25lbnQubWludXRlc0lucHV0LCBtaW51dGVzU2Vjb25kc1JlZ2V4KTtcbiAgICBzZXRJbnB1dFByb3BlcnR5KCdzZWNvbmRzJywgY29tcG9uZW50LnNlY29uZHNJbnB1dCwgbWludXRlc1NlY29uZHNSZWdleCk7XG4gICAgc2V0SW5wdXRQcm9wZXJ0eSgnbWVyaWRpZW0nLCBjb21wb25lbnQubWVyaWRpZW1JbnB1dCwgbWVyaWRpZW1SZWdleCk7XG5cbiAgICBjb21wb25lbnQuc2V0UHJvcGVydHkoJ3RpbWUnLCBmYXN0bi5wcm9wZXJ0eShudWxsLCBmdW5jdGlvbiB1cGRhdGUodGltZSl7XG4gICAgICAgIGlmKCF0aW1lKXtcbiAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuXG4gICAgICAgIHZhciBtYXRjaCA9IHRpbWUubWF0Y2godGltZVJlZ2V4KTtcblxuICAgICAgICBpZighbWF0Y2gpIHtcbiAgICAgICAgICAgIGNvbXBvbmVudC5ob3VycyhudWxsKTtcbiAgICAgICAgICAgIGNvbXBvbmVudC5taW51dGVzKG51bGwpO1xuICAgICAgICAgICAgY29tcG9uZW50LnNlY29uZHMobnVsbCk7XG4gICAgICAgICAgICBjb21wb25lbnQubWVyaWRpZW0obnVsbCk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBjb21wb25lbnQuaG91cnMocGFyc2VJbnQobWF0Y2hbMV0pKTtcbiAgICAgICAgICAgIGNvbXBvbmVudC5taW51dGVzKHBhcnNlSW50KG1hdGNoWzJdKSk7XG4gICAgICAgICAgICBjb21wb25lbnQuc2Vjb25kcyhwYXJzZUludChtYXRjaFszXSkpO1xuICAgICAgICAgICAgY29tcG9uZW50Lm1lcmlkaWVtKG1hdGNoWzRdKTtcbiAgICAgICAgfVxuICAgICAgICB2YWx1ZUNoYW5nZShjb21wb25lbnQpO1xuICAgIH0pKTtcblxuICAgIGNvbXBvbmVudC5vbignY2hhbmdlJywgdmFsdWVDaGFuZ2UuYmluZChudWxsLCBjb21wb25lbnQpKTtcbiAgICBjb21wb25lbnQub24oJ2F0dGFjaCcsIHZhbHVlQ2hhbmdlLmJpbmQobnVsbCwgY29tcG9uZW50KSk7XG5cbiAgICBmdW5jdGlvbiBjcmVhdGVTZXBlcmF0b3IoKSB7XG4gICAgICAgIHJldHVybiBjcmVsKCdzcGFuJyxcbiAgICAgICAgICAgIHtjbGFzczogJ3NlcGVyYXRvcid9LFxuICAgICAgICAgICAgJzonXG4gICAgICAgICk7XG4gICAgfVxuXG4gICAgY29tcG9uZW50LnJlbmRlciA9IGZ1bmN0aW9uKCkge1xuICAgICAgICBjb21wb25lbnQuZWxlbWVudCA9IGNyZWwoJ3NwYW4nLCB7Y2xhc3M6ICd0aW1lUGlja2VyJ30sXG4gICAgICAgICAgICBjb21wb25lbnQuaG91cnNJbnB1dCxcbiAgICAgICAgICAgIGNvbXBvbmVudC5taW51dGVzRW5hYmxlZCgpID8gY3JlYXRlU2VwZXJhdG9yKCkgOiBudWxsLFxuICAgICAgICAgICAgY29tcG9uZW50Lm1pbnV0ZXNFbmFibGVkKCkgPyBjb21wb25lbnQubWludXRlc0lucHV0IDogbnVsbCxcbiAgICAgICAgICAgIGNvbXBvbmVudC5zZWNvbmRzRW5hYmxlZCgpID8gY3JlYXRlU2VwZXJhdG9yKCkgOiBudWxsLFxuICAgICAgICAgICAgY29tcG9uZW50LnNlY29uZHNFbmFibGVkKCkgPyBjb21wb25lbnQuc2Vjb25kc0lucHV0IDogbnVsbCxcbiAgICAgICAgICAgIGNvbXBvbmVudC5tZXJpZGllbUlucHV0XG4gICAgICAgICk7XG5cbiAgICAgICAgdmFyIGRvY0NvbXBvbmVudCA9IGRvYyhjb21wb25lbnQuY29tcG9uZW50RWxlbWVudCksXG4gICAgICAgICAgICBkb2NIb3VycyA9IGRvYyhjb21wb25lbnQuaG91cnNJbnB1dCksXG4gICAgICAgICAgICBkb2NNaW51dGVzID0gZG9jKGNvbXBvbmVudC5taW51dGVzSW5wdXQpLFxuICAgICAgICAgICAgZG9jU2Vjb25kcyA9IGRvYyhjb21wb25lbnQuc2Vjb25kc0lucHV0KSxcbiAgICAgICAgICAgIGRvY01lcmlkaWVtID0gZG9jKGNvbXBvbmVudC5tZXJpZGllbUlucHV0KTtcblxuICAgICAgICBjb21wb25lbnQubWVyaWRpZW0oJ0FNJyk7XG5cbiAgICAgICAgZG9jSG91cnMub24oJ2NoYW5nZScsIGZ1bmN0aW9uKGV2ZW50KSB7XG4gICAgICAgICAgICBjb21wb25lbnQuaG91cnMoY29tcG9uZW50LmhvdXJzSW5wdXQudmFsdWUpO1xuICAgICAgICB9KTtcblxuICAgICAgICBkb2NNaW51dGVzLm9uKCdjaGFuZ2UnLCBmdW5jdGlvbihldmVudCkge1xuICAgICAgICAgICAgY29tcG9uZW50Lm1pbnV0ZXMoY29tcG9uZW50Lm1pbnV0ZXNJbnB1dC52YWx1ZSk7XG4gICAgICAgIH0pO1xuXG4gICAgICAgIGRvY1NlY29uZHMub24oJ2NoYW5nZScsIGZ1bmN0aW9uKGV2ZW50KSB7XG4gICAgICAgICAgICBjb21wb25lbnQuc2Vjb25kcyhjb21wb25lbnQuc2Vjb25kc0lucHV0LnZhbHVlKTtcbiAgICAgICAgfSk7XG5cbiAgICAgICAgZG9jTWVyaWRpZW0ub24oJ2NoYW5nZScsIGZ1bmN0aW9uKGV2ZW50KSB7XG4gICAgICAgICAgICBjb21wb25lbnQubWVyaWRpZW0oY29tcG9uZW50Lm1lcmlkaWVtSW5wdXQudmFsdWUpO1xuICAgICAgICB9KTtcblxuICAgICAgICBkb2NIb3Vycy5vbignZm9jdXMnLCBmdW5jdGlvbihldmVudCkge1xuICAgICAgICAgICAgZG9jQ29tcG9uZW50LmFkZENsYXNzKCdmb2N1cycpO1xuICAgICAgICB9KTtcblxuICAgICAgICBkb2NNaW51dGVzLm9uKCdmb2N1cycsIGZ1bmN0aW9uKGV2ZW50KSB7XG4gICAgICAgICAgICBkb2NDb21wb25lbnQuYWRkQ2xhc3MoJ2ZvY3VzJyk7XG4gICAgICAgIH0pO1xuXG4gICAgICAgIGRvY1NlY29uZHMub24oJ2ZvY3VzJywgZnVuY3Rpb24oZXZlbnQpIHtcbiAgICAgICAgICAgIGRvY0NvbXBvbmVudC5hZGRDbGFzcygnZm9jdXMnKTtcbiAgICAgICAgfSk7XG5cbiAgICAgICAgZG9jTWVyaWRpZW0ub24oJ2ZvY3VzJywgZnVuY3Rpb24oZXZlbnQpIHtcbiAgICAgICAgICAgIGRvY0NvbXBvbmVudC5hZGRDbGFzcygnZm9jdXMnKTtcbiAgICAgICAgfSk7XG5cbiAgICAgICAgZG9jSG91cnMub24oJ2JsdXInLCBmdW5jdGlvbihldmVudCkge1xuICAgICAgICAgICAgZG9jQ29tcG9uZW50LnJlbW92ZUNsYXNzKCdmb2N1cycpO1xuICAgICAgICB9KTtcblxuICAgICAgICBkb2NNaW51dGVzLm9uKCdibHVyJywgZnVuY3Rpb24oZXZlbnQpIHtcbiAgICAgICAgICAgIGRvY0NvbXBvbmVudC5yZW1vdmVDbGFzcygnZm9jdXMnKTtcbiAgICAgICAgfSk7XG5cbiAgICAgICAgZG9jU2Vjb25kcy5vbignYmx1cicsIGZ1bmN0aW9uKGV2ZW50KSB7XG4gICAgICAgICAgICBkb2NDb21wb25lbnQucmVtb3ZlQ2xhc3MoJ2ZvY3VzJyk7XG4gICAgICAgIH0pO1xuXG4gICAgICAgIGRvY01lcmlkaWVtLm9uKCdibHVyJywgZnVuY3Rpb24oZXZlbnQpIHtcbiAgICAgICAgICAgIGRvY0NvbXBvbmVudC5yZW1vdmVDbGFzcygnZm9jdXMnKTtcbiAgICAgICAgfSk7XG5cbiAgICAgICAgbW9ycmlzb24oe1xuICAgICAgICAgICAgcGFyZW50RWxlbWVudDogY29tcG9uZW50LmVsZW1lbnQsXG4gICAgICAgICAgICB2YWxpZGF0b3JzOiB7XG4gICAgICAgICAgICAgICAgJy50aW1lUGlja2VyIC5ob3Vycyc6IC9eMD9bMC05XSR8XlswLTFdWzAtMl0kLyxcbiAgICAgICAgICAgICAgICAnLnRpbWVQaWNrZXIgLm1pbnV0ZXMnOiAvXjA/WzAtOV0kfF5bMC01XVswLTldJC8sXG4gICAgICAgICAgICAgICAgJy50aW1lUGlja2VyIC5zZWNvbmRzJzogL14wP1swLTldJHxeWzAtNV1bMC05XSQvXG4gICAgICAgICAgICB9XG4gICAgICAgIH0pO1xuXG4gICAgICAgIGNvbXBvbmVudC5lbWl0KCdyZW5kZXInKTtcbiAgICAgICAgcmV0dXJuIGNvbXBvbmVudDtcbiAgICB9O1xuXG4gICAgcmV0dXJuIGNvbXBvbmVudDtcbn07XG5cbm1vZHVsZS5leHBvcnRzLmV4cGVjdGVkQ29tcG9uZW50cyA9IFsnX2dlbmVyaWMnXTtcbiJdfQ==
