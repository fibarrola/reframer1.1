function dragover(e) {
    e.preventDefault();
}

function dragentercanvas(e) {
    e.preventDefault();
    canvas.classList.add("drop-ready");
}

function dropCanvas(e) {
    canvas.classList.remove("drop-ready");
    let i = e.dataTransfer.getData("text/plain");
    // to do switch around mainsketch imports?
    controller.sketches[i].importTo(mainSketch);
}

function dragleavecanvas(e) {
    e.preventDefault();
    canvas.classList.remove("drop-ready");
}

sketchContainer.addEventListener("dragover", dragover);
sketchContainer.addEventListener("dragenter", dragentercanvas);
sketchContainer.addEventListener("dragleave", dragleavecanvas);
sketchContainer.addEventListener("drop", dropCanvas);

function dragoverhover(e) {
    e.preventDefault();
    sketchGrid.classList.add("drop-ready");
    sketchGrid.classList.remove("basic-background");
}

function dragleavesketch(e) {
    e.preventDefault();
    sketchGrid.classList.remove("drop-ready");
    sketchGrid.classList.add("basic-background");
}

function dropSketch(e) {
    // AI to Static
    sketchGrid.classList.remove("drop-ready");
    const sketchCountIndex = e.dataTransfer.getData("text/plain");
    if (document.querySelector(`#AI-sketch-item-${sketchCountIndex}`)) {
        let importing = controller.sketches[sketchCountIndex];
        importing.saveStatic(importing.extractSVG());
    }
}

// sketchGrid.addEventListener("dragover", dragoverhover);
// sketchGrid.addEventListener("dragleave", dragleavesketch);
// sketchGrid.addEventListener("drop", dropSketch);

// Drawing Controls
document.querySelectorAll(".pen-mode").forEach((elem) => {
    elem.addEventListener("click", () => {
        setPenMode(elem.id, elem);
    });
});
document.querySelectorAll(".swatch").forEach((elem) => {
    elem.addEventListener("click", () => {
        let col = window.getComputedStyle(elem).backgroundColor;
        alphaSlider.value = 100;
        controller.strokeColor = col;
        getSelectedPaths().forEach((path) => (path.strokeColor = col));
        picker.setColor(col);
        setPenMode("pen", pen);
    });
});

document.getElementById("delete").addEventListener("click", () =>
    openModal({
        title: "Clearing Canvas",
        message: "Are you sure you want to delete your drawing?",
        confirmAction: () => {
            ungroup();
            // Save before clearing
            mainSketch.svg = paper.project.exportSVG({
                asString: true,
            });
            logger.event("clear-sketch");
            mainSketch.sketchLayer.clear();
            modal.style.display = "none";

            if (useAI) {
                if (controller.clipDrawing || controller.drawState === "pause") {
                    killExploratorySketches();
                    controller.stop();
                    controller.resetMetaControls();
                    controller.clipDrawing = false;
                }

                emptyExplorer();
                document.getElementById("explore-margin").display = "none";
                // document.getElementById("add-refine").style.display = "none";

                controller.lastPrompt = null;
                updateSelectUI();
            } else {
                loadPartial();
            }
        },
    })
);

deleteHandler.addEventListener("click", (e) => {
    deleteItems();
});

copyHandler.addEventListener("click", (e) => {
    if (controller.boundingBox) {
        controller.boundingBox.remove();
        controller.boundingBox = null;
    }
    let copy = controller.transformGroup.clone();
    let inserted = mainSketch.sketchLayer.insertChildren(
        copy.index,
        copy.removeChildren()
    );
    copy.remove();
    controller.transformGroup.selected = false; //deselect og

    ungroup();
    // inserted.forEach((pathCopy) => (pathCopy.data.fixed = true)); //save to user paths
    createGroup(inserted);
    fitToSelection(getSelectedPaths(), "moving");
    updateSelectUI();

    mainSketch.svg = paper.project.exportSVG({
        asString: true,
    });
});

fixedHandler.addEventListener("click", (e) => {
    // let i = fixedHandler.querySelector("i");
    // i.classList.toggle("fa-lock");
    // i.classList.toggle("fa-unlock");
    isFixedGroup() ? fixGroup(false) : fixGroup(true);
    updateFixedUI();
});

// document.getElementById("begin").addEventListener("click", () => {
//     if (logger.userName !== "" && logger.userName !== undefined) {
//         document.getElementById("sliding-overlay").style.bottom = "100%";
//         logger.event("begin-pilot");
//     }
// });

document.getElementById("undo").addEventListener("click", () => {
    sketchHistory.undo();
});

document.getElementById("redo").addEventListener("click", () => {
    sketchHistory.redo();
});

document.getElementById("save").addEventListener("click", () => {
    download();
});

document.getElementById("width-slider").oninput = function() {
    setPointSize(this.value);
};

rotateSlider.oninput = function() {
    transformGroup(controller.transformGroup, "rotation", this.value);
};

scaleSlider.oninput = function() {
    transformGroup(controller.transformGroup, "scaling", this.value / 5);
};

rotateNumber.oninput = function() {
    transformGroup(controller.transformGroup, "rotation", this.value);
};

scaleNumber.oninput = function() {
    transformGroup(controller.transformGroup, "scaling", this.value / 5);
};

alphaSlider.oninput = function() {
    let rgba = getRGBA(this.value / 100);
    controller.alpha = this.value / 100;
    controller.strokeColor = rgba;
    setThisColor(rgba);
};

// tidy
document
    .getElementById("circle-small")
    .parentElement.addEventListener("click", (e) => {
        setPointSize(document.getElementById("circle-small").offsetWidth);
        setPenMode("pen", pen);
    });

document
    .getElementById("circle-med")
    .parentElement.addEventListener("click", (e) => {
        setPointSize(document.getElementById("circle-med").offsetWidth);
        setPenMode("pen", pen);
    });

document
    .getElementById("circle-large")
    .parentElement.addEventListener("click", (e) => {
        setPointSize(document.getElementById("circle-large").offsetWidth);
        setPenMode("pen", pen);
    });

document.getElementById("close-explorer").addEventListener("click", (e) => {
    emptyExplorer();
    showHide(document.getElementById("explore-margin"));
});

document.getElementById("empty").addEventListener("click", (e) => {
    emptyExplorer();
});

// document.getElementById("settings").addEventListener("click", () => {
//     openModal({
//         title: "Advanced",
//         message: "Change the drawing behaviour and UI.",
//         ui: document.getElementById("settings-ui"),
//     });
// });

timeKeeper.oninput = function() {
    if (this.value === 0) return; // 0 is pre-generation state
    historyIndex = this.value;
    mainSketch.sketchLayer.clear();
    if (controller.numTraces > 1) {
        showTraceHistoryFrom(historyIndex);
    } else {
        let stored = sketchHistory.historyHolder[historyIndex];
        mainSketch.load(
            1,
            stored.svg,
            false // don't reapply opacity
        );
    }
};

palette.addEventListener("click", () => {
    showHide(controlPanel);
    palette.classList.toggle("panel-open");
});

prompt.addEventListener("input", (e) => {
    // controller.prompt = e.target.value.toLowerCase();
    controller.prompt = e.target.value;

    if (controller.prompt === "") {
        aiMessage.innerHTML = ` What are we drawing?`;
        controllerUI.forEach((elem) => elem.classList.add("inactive-section"));
    } else {
        aiMessage.innerHTML = `Ok, ${controller.prompt}.`;
        controllerUI.forEach((elem) => elem.classList.remove("inactive-section"));
    }

    console.log(controller.prompt);
});

prompt.addEventListener("blur", () => {
    mainSketch.svg = paper.project.exportSVG({
        asString: true,
    });
    logger.event("set-prompt");
});

// document.getElementById("user-name").addEventListener("input", (e) => {
//     logger.userName = e.target.value;
// });

document.getElementById("draw").addEventListener("click", () => {
    if (socket) {
        controller.draw();
        mainSketch.svg = paper.project.exportSVG({
            asString: true,
        });
        logger.event("start-drawing");
    }
});

document.getElementById("explore").addEventListener("click", () => {
    if (socket) {
        if (noPrompt()) {
            openModal({
                title: "Type a prompt first!",
                message: "You need a target for AI sketchs.",
                confirmAction: () => (controlPanel.style.display = "flex"),
            });
            return;
        } else {
            // TO DO: Clean up old scopes (now unused) // controller.exploreScopes
            // const total = controller.sketchScopeIndex + Math.floor(Math.random() * 5);
            total = 4;
            for (let i = 0; i < 4; i++) {
                explorer.removeChild(explorer.firstChild);
            }

            for (let i = 0; i < 4; i++) {
                let sketch = new Sketch(
                    controller.sketchScopeIndex,
                    sketchScope,
                    sketchSize,
                    "AI"
                );
                let newElem = sketch.renderMini();
                controller.exploreScopes.push(controller.sketchScopeIndex);
                explorer.appendChild(newElem);
                controller.newExploreSketch(controller.sketchScopeIndex);
                controller.sketchScopeIndex += 1;
                // }
            }
            controller.clipDrawing = true;
            setActionUI("explore");
            mainSketch.svg = paper.project.exportSVG({
                asString: true,
            });
            logger.event("start-exploring");
        }
    }
});

stopButton.addEventListener("click", () => {
    console.log(controller.drawState);
    stopDrawer();
});

sendToBack.addEventListener("click", () => {
    controller.transformGroup.sendToBack();
    controller.boundingBox.sendToBack();
});

moveUp.addEventListener("click", () => {
    let thisItem = controller.transformGroup;
    mainSketch.sketchLayer.insertChild(thisItem.index + 1, thisItem);
    // thisItem.insertAbove(thisItem);
    controller.boundingBox.insertBelow(thisItem);
});

// document.getElementById("prune").addEventListener("click", () => {
//     console.log(controller.drawState);
//     if (socket) {
//         if (
//             controller.drawState === "stop" ||
//             controller.drawState === "stop-prune" ||
//             controller.drawState === "stopSingle"
//         ) {
//             // after  draw
//             controller.prune();
//         }
//         mainSketch.svg = paper.project.exportSVG({
//             asString: true,
//         });
//         logger.event("prune-sketch");
//     }
// });

document.getElementById("focus").addEventListener("click", () => {
    console.log(controller.drawState);
    mainSketch.frameLayer.activate();
    setPenMode("local", null);
    // activate focus
    // open focus panel
    // allow drawing rectangles on new layer
    // on mouse up, position UI above active frame
    // write in local prompt ontop of frame
    // add to the focus panel
    //

    // showHide(localPrompts);
});

document.getElementById("go-back").addEventListener("click", () => {
    if (
        controller.drawState === "stop" ||
        controller.drawState === "stop-prune"
    ) {
        // mainSketch.arrange();
        // LOAD FIXED PATH LIST ?
        incrementHistory();
        let stored = sketchHistory.historyHolder[1];
        timeKeeper.value = 1;
        mainSketch.load(1, stored.svg);
    }
});

// document.getElementById("random-prompt").addEventListener("click", () => {
//     let randomPrompt =
//         promptList[Math.floor(Math.random() * promptList.length)].toLowerCase();
//     prompt.value = randomPrompt;
//     controller.prompt = randomPrompt;
//     aiMessage.innerHTML = `Ok, ${randomPrompt}.`;
//     document
//         .querySelectorAll(".inactive-section")
//         .forEach((elem) => elem.classList.remove("inactive-section"));
// });

// Control panel

controlPanel.onmousedown = (e) => {
    if (window.innerWidth > 700) {
        let bounds = document.getElementById("ai-content").getBoundingClientRect();
        e = e || window.event;
        pos3 = e.clientX;
        pos4 = e.clientY;
        if (
            pos3 < bounds.left ||
            pos3 > bounds.right ||
            pos4 < bounds.top ||
            pos4 > bounds.bottom
        ) {
            document.onmouseup = closeDragElement;
            document.onmousemove = (e) => elementDrag(e, controlPanel);
        }
    }
};

// sketchBook.onmousedown = (e) => {
//     if (window.innerWidth > 700) {
//         let content = document.getElementById("static-sketches");
//         let bounds = content.getBoundingClientRect();
//         e = e || window.event;
//         pos3 = e.clientX;
//         pos4 = e.clientY;
//         if (
//             pos3 < bounds.left ||
//             pos3 > bounds.right ||
//             pos4 < bounds.top ||
//             pos4 > bounds.bottom
//         ) {
//             document.onmouseup = closeDragElement;
//             document.onmousemove = (e) => elementDrag(e, sketchBook);
//             console.log("dragging");
//         }
//     }
// };

localPrompts.onmousedown = (e) => {
    if (window.innerWidth > 700) {
        e = e || window.event;
        pos3 = e.clientX;
        pos4 = e.clientY;
        document.onmouseup = closeDragElement;
        document.onmousemove = (e) => elementDrag(e, localPrompts);
        console.log("dragging");
    }
};

document.getElementById("swatches").onmousedown = (e) => {
    if (window.innerWidth > 700) {
        e = e || window.event;
        pos3 = e.clientX;
        pos4 = e.clientY;
        document.onmouseup = closeDragElement;
        document.onmousemove = (e) =>
            elementDrag(e, document.getElementById("swatches"));
        console.log("dragging");
    }
};

document.getElementById("explore-margin").onmousedown = (e) => {
    if (window.innerWidth > 700) {
        let content = document.getElementById("explore-sketches");
        let bounds = content.getBoundingClientRect();
        e = e || window.event;
        pos3 = e.clientX;
        pos4 = e.clientY;
        if (
            pos3 < bounds.left ||
            pos3 > bounds.right ||
            pos4 < bounds.top ||
            pos4 > bounds.bottom
        ) {
            document.onmouseup = closeDragElement;
            // document.onmousemove = (e) => elementDrag(e, sketchBook);
            document.onmousemove = (e) =>
                elementDrag(e, document.getElementById("explore-margin"));
        }
    }
};

function elementDrag(e, item) {
    e = e || window.event;
    // e.preventDefault();
    pos1 = pos3 - e.clientX;
    pos2 = pos4 - e.clientY;
    pos3 = e.clientX;
    pos4 = e.clientY;
    item.style.top = item.offsetTop - pos2 + "px";
    item.style.left = item.offsetLeft - pos1 + "px";
}

function closeDragElement() {
    document.onmouseup = null;
    document.onmousemove = null;
}

document.querySelectorAll(".tab-item").forEach((tab) => {
    tab.addEventListener("click", () => {
        if (!tab.classList.contains("active-tab")) {
            document
                .querySelectorAll(".tab-item")
                .forEach((tabItem) => tabItem.classList.toggle("active-tab"));

            if (tab.id == "style-tab") {
                document.getElementById("style-content").parentElement.style.display =
                    "block";
                document.getElementById("ai-content").parentElement.style.display =
                    "none";
            } else {
                document.getElementById("style-content").parentElement.style.display =
                    "none";
                document.getElementById("ai-content").parentElement.style.display =
                    "block";
            }
        }
    });
});

// document.getElementById("scrapbook").addEventListener("click", () => {
//     showHide(sketchBook);
//     document.getElementById("scrapbook").classList.toggle("panel-open");
// });

// document.querySelectorAll(".card-icon-background").forEach((elem) => {
//     elem.addEventListener("click", () => {
//         elem.parentElement.parentElement.remove();
//     });
// });

// document.getElementById("save-sketch").addEventListener("click", () => {
//     ungroup();
//     mainSketch.sketchLayer.getItems().forEach((path) => {
//         path.selected = false;
//     });

//     mainSketch.saveStatic(
//         mainSketch.extractScaledSVG(1 / scaleRatio) //adds as backup
//     );
//     mainSketch.svg = paper.project.exportSVG({
//         asString: true,
//     });
//     logger.event("saved-in-sketchbook");
// });

// const autoButton = document.getElementById("autodraw-button");
// autoButton.addEventListener("click", () => {
//     if (controller.doneSketching !== null) {
//         controller.doneSketching = null; // never add
//         autoButton.innerHTML = "Solo draw";
//         logger.event("solo-drawing");
//     } else {
//         autoButton.innerHTML = "Collab draw!";
//         controller.doneSketching = 4000;
//         logger.event("collab-drawing");
//     }
//     autoButton.classList.toggle("inactive-pill");
// });

// document.getElementById("show-all-paths").addEventListener("click", () => {
//     controller.showAllLines = !controller.showAllLines;
//     document.getElementById("show-all-paths").classList.toggle("inactive-pill");
// });

document.getElementById("num-squiggles").oninput = function() {
    controller.maxCurves = parseInt(this.value);
    setLineLabels(mainSketch.sketchLayer);
};

document.getElementById("num-traces").oninput = function() {
    controller.numTraces = parseInt(this.value);
};

// document.getElementById("overwrite").addEventListener("click", () => {
//     if (controller.allowOverwrite) {
//         document.getElementById("overwrite").innerHTML = "Copy";
//     } else {
//         document.getElementById("overwrite").innerHTML = "Overwrite";
//     }
//     document.getElementById("overwrite").classList.toggle("inactive-pill");
//     controller.allowOverwrite = !controller.allowOverwrite;
// });

const respectSlider = document.getElementById("respect-slider");
let lastFixation = controller.useFixation;

respectSlider.oninput = function() {
    controller.useFixation = parseInt(this.value);
    let msg = controller.useFixation > 2 ? "More" : "Less";
    document.getElementById("fix-label").innerHTML = msg;
};

respectSlider.onmousedown = () => {
    pauseActiveDrawer();
    lastFixation = controller.useFixation;
};

respectSlider.onmouseup = () => {
    if (controller.liveCollab) {
        if (controller.useFixation !== lastFixation) {
            controller.continueSketch();
        }
        controller.liveCollab = false;
    }
};

// Shortcuts
window.addEventListener("keydown", function(event) {
    if (event.metaKey && event.shiftKey) {
        if (event.code === "KeyP") {
            setPenMode("pen", pen);
        }
        if (event.code === "KeyS") {
            setPenMode("select", document.getElementById("select"));
        }
        if (event.code === "KeyE") {
            setPenMode("erase", document.getElementById("erase"));
        }
        if (event.code === "KeyU") {
            sketchHistory.undo();
        }
        if (event.code === "KeyR") {
            sketchHistory.redo();
        }
    }

    if (event.key == "Escape") {
        // close the frame mode
        stopDrawer();
    }

    if (document.activeElement !== prompt) {
        if (event.key == "Delete" || event.key == "Backspace") {
            deleteItems();
        }
    } else {
        if (event.key == "Enter") {
            if (socket) {
                controller.draw();
                mainSketch.svg = paper.project.exportSVG({
                    asString: true,
                });
                logger.event("start-drawing");
            }
        }
    }
});

// document.getElementById("set-background").onclick = function() {
//     canvas.style.backgroundColor = controller.strokeColor;
// };

// document.getElementById("moodboard-cross").addEventListener("click", () => {
//     if (!moodboard.style.display || moodboard.style.display === "none") {
//         moodboard.style.display = "block";
//     } else {
//         moodboard.style.display = "none";
//     }
// });

// LOAD UI

// Random partial sketch
if (!useAI) {
    loadPartial();
}

const picker = new Picker({
    parent: document.getElementById("color-picker"),
    popup: false,
    alpha: false,
    defaultColor: "#0cf",
    editor: false,
    editorFormat: "hex", // or 'rgb', 'hsl'
});

picker.setColor(controller.strokeColor);
picker.onChange = (color) => {
    controller.strokeColor = color.rgbaString;
    controller.strokeColor = getRGBA(controller.alpha);

    getSelectedPaths().forEach(
        (item) => (item.strokeColor = controller.strokeColor)
    );
    setThisColor(controller.strokeColor);
};

setLineLabels(mainSketch.sketchLayer);
setActionUI("inactive");
setPointSize(controller.strokeWidth);

// const defaults = new PaperScope();
// defaults.activate();
// for (let i = 0; i < 4; i++) {
//     let sketch = new Sketch(null, defaults, sketchSize);
//     let newElem = sketch.renderMini();
//     // controller.sketchScopeIndex += 1; //remove later
//     newElem.classList.add("inactive-sketch");
//     document.getElementById("explore-sketches").appendChild(newElem);
// }

// sketchBook.style.left =
//     window.innerWidth - sketchBook.getBoundingClientRect().width - 5 + "px";

if (window.innerWidth <= 700) {
    penControls.appendChild(document.getElementById("scrapbook"));
    penControls.appendChild(document.getElementById("delete"));
    sketchBook.style.display = "none";
    document.getElementById("scrapbook").classList.toggle("panel-open");
    document.getElementById("palette").classList.toggle("panel-open");
    controlPanel.style.display = "none";

    let saveText = document.createElement("p");
    saveText.innerHTML = "Next";
    document.getElementById("top-action-right").prepend(saveText);

    document.getElementById("save").removeEventListener("click", () => {
        download();
    });
    document
        .getElementById("save")
        .parentElement.addEventListener("click", () => {
            download();
        });
}