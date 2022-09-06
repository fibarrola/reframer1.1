if (useAI) {
    ws.onmessage = function(event) {
        try {
            loadResponse(JSON.parse(event.data));
        } catch (e) {
            if ((event.data.match(/{/g) || []).length > 1) {
                console.log("Parsing Concurrent JSON events");
            }
            console.log("Cooked ", e);
            controller.clipDrawing = false;
        }
    };
}

const createGroup = (items) => {
    setDefaultTransform();
    controller.transformGroup = new Group({
        children: items,
        strokeScaling: false,
        transformContent: false,
    });
    return controller.transformGroup;
};

const transformGroup = (g, t, a) => {
    g[t] = a;
    hideSelectUI(false);
    let items = getSelectedPaths();
    fitToSelection(items, "rotating");
    updateSelectUI();
};

const scaleGroup = (group, to) => {
    group.scale(to, new Point(0, 0));
    group.children.forEach((item) => {
        item.strokeWidth *= to;
    });
    return group;
};

const setPointSize = (s) => {
    const point = document.getElementById("point-size");
    controller.strokeWidth = s;
    point.style.width = controller.strokeWidth + "px";
    point.style.height = controller.strokeWidth + "px";

    if (controller.transformGroup) {
        controller.transformGroup.getItems(
            (item) => (item.strokeWidth = controller.strokeWidth)
        );
    }
};

const ungroup = () => {
    let selected;
    if (controller.transformGroup !== null) {
        controller.transformGroup.applyMatrix = true;
        selected = controller.transformGroup.removeChildren();
        mainSketch.sketchLayer.insertChildren(
            controller.transformGroup.index,
            selected
        );
        controller.transformGroup.remove();
        controller.transformGroup = null;
    }
    hideSelectUI();
    return selected;
};

const isFixedGroup = () =>
    !controller.transformGroup.children.filter(
        (item) => !item.data.fixed || item.data.fixed === undefined
    ).length; //no ai paths

const fixGroup = (b) => {
    controller.transformGroup.getItems((item) => (item.data.fixed = b));
};

//TODO: Add stroke width so no overflow over bounds?
const fitToSelection = (items, state) => {
    let bbox = items.reduce((bbox, item) => {
        return !bbox ? item.bounds : bbox.unite(item.bounds);
    }, null);
    controller.boundingBox = new Path.Rectangle(bbox);
    controller.boundingBox.set(rectangleOptions); //outline
    controller.boundingBox.sendToBack();
    controller.boundingBox.data.state = state;
    return controller.boundingBox;
};

const getSelectedPaths = () =>
    mainSketch.sketchLayer.getItems().filter((path) => path.selected);

const noPrompt = () =>
    controller.prompt === "" ||
    controller.prompt === null ||
    controller.prompt === prompt.getAttribute("placeholder");

// const switchControls = () => {
//     if (controller.buttonControlLeft) {
//         console.log(window.innerWidth);
//         buttonPanel.style.left = `${window.innerWidth - buttonPanel.offsetWidth}px`;
//     } else {
//         buttonPanel.style.left = 0;
//     }
//     controller.buttonControlLeft = !controller.buttonControlLeft;
// };

const isDeselect = (e, hitResult) => {
    // TO change to simple hit test
    let isInBounds = null;
    if (controller.boundingBox) {
        isInBounds =
            e.point.x > controller.boundingBox.bounds.left &&
            e.point.x < controller.boundingBox.bounds.right &&
            e.point.y > controller.boundingBox.bounds.top &&
            e.point.y < controller.boundingBox.bounds.bottom;
    }
    return (!hitResult && !isInBounds) || (!hitResult && isInBounds == null);
};

const deleteItems = () => {
    // Save
    let selectedPaths = ungroup();
    selectedPaths.forEach((path) => {
        path.selected = false;
    });

    sketchHistory.pushUndo();

    // Delete
    selectedPaths.forEach((path) => path.remove());

    // Save new SVG
    mainSketch.svg = paper.project.exportSVG({
        asString: true,
    });

    if (controller.liveCollab) {
        controller.continueSketch();
        controller.liveCollab = false;
    }
    // logger.event("deleted-path");
};

const getHistoryBatch = (maxSize, startIdx) => {
    let len = sketchHistory.historyHolder.length;
    if (len <= 1) return null;
    let traceList = [];
    let batchSize = Math.min(maxSize, startIdx); // not first item

    for (let i = 0; i < batchSize; i++) {
        // num traces
        traceList.push(sketchHistory.historyHolder[startIdx - i - 1]);
    }
    return traceList;
};

const calcRollingLoss = () => {
    const items = getHistoryBatch(
        setTraces.value,
        sketchHistory.historyHolder.length - 1
    );
    if (items) {
        const sum = items.reduce(
            (partialSum, historyItem) => partialSum + historyItem.loss,
            0
        );
        const newRollingLoss = sum / items.length;
        controller.lastRollingLoss = newRollingLoss;
    }
};

// TO DO make worker with new loader
const showTraceHistoryFrom = (fromIndex) => {
    const items = getHistoryBatch(controller.numTraces, fromIndex);
    if (items) {
        controller.traces = null;
        let refList = [];
        for (let stored of items) {
            // TO DO CHANGE??? so fixed paths
            mainSketch.sketchLayer.importSVG(stored.svg); //overlay
            // refList.push(mainSketch.load(1, stored.svg, stored.num));
        }
        controller.traces = refList;
    }
};

const incrementHistory = () => {
    sketchHistory.historyHolder.push({
        svg: mainSketch.svg,
    });
    timeKeeper.setAttribute("max", String(controller.step + 1));
    timeKeeper.value = String(controller.step + 1);
    setTraces.setAttribute("max", String(controller.step + 1));
    controller.step += 1;
};

const pauseActiveDrawer = () => {
    if (
        controller.drawState !== "explore" && //don't include this state
        controller.activeStates.includes(controller.drawState)
    ) {
        // TO DO: check if can just check if clip is drawing.. should work?
        controller.liveCollab = true;
        controller.pause(); //continue on pen up
        aiMessage.classList.remove("typed-out");
        aiMessage.innerHTML = `I'mma let you finish...`;
        aiMessage.classList.add("typed-out");
    }
};

const getRGBA = (a) => {
    let rgba = controller.strokeColor.replace(/[^\d,]/g, "").split(",");
    rgba[3] = a;
    return `rgba(${rgba.join()})`;
};

const rgbToHex = (r, g, b) => {
    if (r > 255 || g > 255 || b > 255) throw "Invalid color component";
    return ((r << 16) | (g << 8) | b).toString(16);
};

const download = () => {
    // REMOVE REFs to select box
    // to do: refactor these.
    mainSketch.sketchLayer.getItems().forEach((path) => {
        path.selected = false;
    });
    mainSketch.svg = paper.project.exportSVG({
        asString: true,
    });

    logger.event("save-sketch");

    canvas.toBlob((blob) => {
        let url = window.URL || window.webkitURL;
        let link = url.createObjectURL(blob);
        let isIE = false || !!document.documentMode;
        if (isIE) {
            window.navigator.msSaveBlob(blob, fileName);
        } else {
            let a = document.createElement("a");
            a.setAttribute("download", "sketch.png");
            a.setAttribute("href", link);
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);

            let b = document.createElement("a");
            let text = mainSketch.svg;
            b.setAttribute(
                "href",
                "data:text/plain;charset=utf-8," + encodeURIComponent(text)
            );
            b.setAttribute("download", "sketch.txt");
            document.body.appendChild(b);
            b.click();
            document.body.removeChild(b);
        }
        if (!useAI) {
            mainSketch.sketchLayer.clear();
            loadPartial();
        }
    });
};

const loadResponse = (result) => {
    console.log("Result: ", result);

    if (controller.clipDrawing) {
        // Main
        if (result.status === "None") {
            updateMain(result);
        }

        // Explore
        var matches = result.status.match(/\d+/g); //if status is a num
        if (matches != null) {
            if (result.svg === "") return null;
            let sketch = controller.sketches[parseInt(result.status)];
            sketch.load(
                sketchSize / 224,
                result.svg,
                result.fixed,
                sketch.mainSketch.sketchLayer
            );
        }

        // Prune Main
        if (controller.drawState == "pruning") {
            updateMain(result);
            setActionUI("stop-prune");
            controller.clipDrawing = false; //single update
            incrementHistory(); //still sorted
        }
    }
};

const updateMain = (result) => {
    incrementHistory();
    // set i?
    controller.lastIteration = result.iterations;

    // if (controller.numTraces > 1) {
    //     showTraceHistoryFrom(sketchHistory.historyHolder.length - 1);
    // } else {
    mainSketch.load(
        frame / 224,
        result.svg,
        result.fixed, // FIXED PATH LIST
        true,
        true
    );
    // }
    // calcRollingLoss();
};

const loadPartial = () => {
    const scaleTo = mainSketch.sketchLayer.view.viewSize.width;
    const idx = Math.floor(Math.random() * partialSketches.length);
    const partial = partialSketches[idx][0];
    const drawPrompt = partialSketches[idx][1];
    document.getElementById("partial-message").innerHTML = drawPrompt;
    let loadedPartial = mainSketch.sketchLayer.importSVG(partial);

    loadedPartial.getItems().forEach((item) => {
        if (item instanceof Path) {
            let newElem = mainSketch.sketchLayer.addChild(item.clone());
            newElem.data.fixed = true;
            newElem.strokeCap = "round";
            newElem.strokeJoin = "round";
        }
    });
    loadedPartial.remove();
    scaleGroup(mainSketch.sketchLayer, scaleTo);
    mainSketch.svg = paper.project.exportSVG({
        asString: true,
    });
};