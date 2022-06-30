class SketchHistory {
    constructor(s) {
        this.undoStack = [];
        this.redoStack = [];
        this.historyHolder = [{ svg: "", num: 0 }];
        this.sketch = s;
    }
    pushUndo() {
        this.undoStack.push({
            svg: this.sketch.sketchLayer.project.exportSVG({
                asString: true,
            }),
            num: 0, // FIXED PATH LIST
        });

        this.undoStack.length > 0 ?
            (document.getElementById("undo").style.color = "#ffffff") :
            (document.getElementById("undo").style.color = "#757575");
    }
    pushRedo() {
        this.redoStack.push({
            svg: this.sketch.sketchLayer.project.exportSVG({
                asString: true,
            }),
            num: 0, // FIXED PATH LIST
        });

        this.redoStack.length > 0 ?
            (document.getElementById("redo").style.color = "#ffffff") :
            (document.getElementById("redo").style.color = "#757575");
    }
    undo() {
        if (this.undoStack.length > 0) {
            let last = this.undoStack.pop();
            this.pushRedo();
            this.sketch.sketchLayer.clear();
            this.sketch.load(1, last.svg); //change to fixed list
            logger.event("undo");

            this.undoStack.length === 0 &&
                (document.getElementById("undo").style.color = "#757575");
        }
    }
    redo() {
        if (this.redoStack.length > 0) {
            let last = this.redoStack.pop();
            this.pushUndo();
            this.sketch.sketchLayer.clear();
            this.sketch.load(1, last.svg); //change to fixed list
            logger.event("redo");

            this.redoStack.length === 0 &&
                (document.getElementById("redo").style.color = "#757575");
        }
    }
    clear() {
        this.undoStack = [];
        this.redoStack = [];
    }

    // To Do: Move time slider logic here I think
}

class Controller {
    // Maintains a logical state for sending over WS
    constructor() {
        this.drawState;
        // Sketching Data
        this.prompt = null;
        this.inspireScopes = [];
        this.sketches = {};

        // Defaults
        this.strokeColor = "rgb(24,24,24)";
        this.strokeWidth = 8;
        this.alpha = 1;
        this.penMode = "pen";
        this.clipDrawing = false;
        this.maximumTraces = 1; // todo change
        this.step = 0;
        this.lastRollingLoss = 0;
        this.linesDisabled = false;
        this.activeStates = [
            "drawing",
            "generating",
            "refining",
            "explore",
            "redrawing",
            "continuing",
        ];
        this.lastHistoryIndex = 0;
        this.penDropMode = "select";
        this.sketchScopeIndex = 0;
        // TODO Refactor
        this.buttonControlLeft = true;
        this.doneSketching = null;

        // User Initialised
        this.drawRegion = null;
        this.selectionBox = null;
        this.lastPrompt = null;
        this.isFirstIteration = null;
        this.lastRollingLoss = null;
        this.traces = null;
        this.boundingBox = null;
        this.transformGroup = null;
        this.useFixation = 3;
        this.showAllLines = true;
        this.targetDrawing = false;

        // Settings panel
        this.useAdvanced = false;
        this.initRandomCurves = true;
        this.maxCurves = 48;
        this.addLines = 0;
        this.numTraces = 1;

        this.liveCollab = false;
        this.allowOverwrite = true;
    }
    updateDrawer({
        status,
        sketch,
        hasRegion,
        frameSize,
        prompt,
        lines,
        sketchScopeIndex,
        fixation,
    }) {
        this.isFirstIteration = true; //reset canvas
        this.lastPrompt = prompt;
        const canvasBounds = canvas.getBoundingClientRect(); //avoid canvas width glitches
        const res = {
            status: status,
            data: {
                prompt: prompt,
                // svg: svg,
                sketch,
                random_curves: lines,
                frame_size: frameSize,
                fixation: fixation,
                region: {
                    activate: hasRegion,
                    x1: this.drawRegion ? this.drawRegion.x : 0,
                    y1: this.drawRegion ? canvasBounds.height - this.drawRegion.y : 0,
                    x2: this.drawRegion ?
                        this.drawRegion.x + this.drawRegion.width : canvasBounds.width,
                    y2: this.drawRegion ?
                        canvasBounds.height - this.drawRegion.y - this.drawRegion.height // use non-web y coords
                        :
                        canvasBounds.height, // same as width
                },
                sketch_index: sketchScopeIndex,
            },
        };
        console.log(res);
        ws.send(JSON.stringify(res));
    }
    draw(withRegion = false, svg = null) {
        if (noPrompt()) {
            openModal({
                title: "Type a prompt first!",
                message: "You need a target for AI sketching.",
                confirmAction: () => (controlPanel.style.display = "flex"),
            });
            return;
        }
        if (!this.clipDrawing) {
            this.clipDrawing = true;
            this.targetDrawing = false;
            setPenMode("select", penDrop);
            this.prepare();
            this.updateDrawer({
                status: "draw",
                // svg: svg || mainSketch.svg,
                // svg: mainSketch.sketchLayer.project.exportJSON(), //test
                sketch: mainSketch.sketch,
                // sketchScopeIndex: "None",
                hasRegion: withRegion,
                frameSize: mainSketch.frameSize,
                prompt: this.prompt,
                lines: this.initRandomCurves ? this.addLines : 0, //adding
                fixation: this.useFixation,
            });
            this.step = 0;
            setActionUI("drawing");
        } else {
            throw new Error("Can't continue if already running");
        }
    }
    newExploreSketch(sketchCountIndex) {
        if (!this.clipDrawing) {
            if (!sketchSize) {
                console.error("sketch size not found");
            }
            this.targetDrawing = true;

            this.prepare();
            this.updateDrawer({
                status: "add_new_sketch",
                sketch: mainSketch.sketch,
                hasRegion: false,
                frameSize: mainSketch.frameSize,
                prompt: this.prompt,
                lines: this.addLines,
                sketchScopeIndex: sketchCountIndex,
                fixation: this.useFixation,
            });
        }
    }
    continueSketch() {
        if (!this.clipDrawing) {
            this.clipDrawing = true;

            if (this.targetDrawing) {
                //     explorer.childNodes.forEach((child, i) => {
                //         try {
                //             mainSketch.arrange();
                //             // TO DO CHANGE
                //             setLineLabels(userLayer);
                //             document.getElementById("calc-lines").innerHTML = `Add : 0`;
                //             this.updateDrawer({
                //                 status: "continue_single_sketch",
                //                 svg: mainSketch.svg,
                //                 frameSize: mainSketch.frameSize, //can remove?
                //                 fixation: this.useFixation,
                //                 sketchScopeIndex: controller.inspireScopes[i],
                //             });
                //             setActionUI("continue-explore");
                //         } catch (e) {
                //             console.log("Problem with update");
                //         }
                //     });
            } else {
                try {
                    this.prepare();
                    this.updateDrawer({
                        status: "continue_sketch",
                        sketch: mainSketch.sketch,
                        fixation: this.useFixation,
                    });
                    setActionUI("continuing");
                } catch (e) {
                    console.log("Problem with update");
                }
            }
        } else {
            throw new Error("Can't continue if already running");
        }
    }
    prune() {
        if (!this.clipDrawing) {
            this.clipDrawing = true;

            this.prepare();

            this.updateDrawer({
                status: "prune",
            });
            setActionUI("pruning");
        }
    }
    stop() {
        this.updateDrawer({ status: "stop" });
        setActionUI("stop");
    }
    pause() {
        this.updateDrawer({ status: "stop" });
        this.clipDrawing = false;
        setActionUI("pause");
    }
    stopSingle(i) {
        this.updateDrawer({
            status: "stop_single_sketch",
            sketchScopeIndex: i,
        });
    }
    prepare() {
        sketchHistory.clear();
        // make sure correct
        ungroup();
        mainSketch.sketchLayer.getItems().forEach((path) => {
            path.selected = false;
        });

        mainSketch.buildSketch();

        setLineLabels(mainSketch.sketchLayer);
        document.getElementById("calc-lines").innerHTML = `Add : 0`;
    }
    resetMetaControls() {
        document.getElementById("prune").classList.add("inactive-action");
        document.getElementById("history-block").style.display = "none";
        this.step = 0;
        timeKeeper.setAttribute("max", "0");
        timeKeeper.value = "0";
        sketchHistory.historyHolder = [{ svg: "", num: 0 }];
    }
}

controller = new Controller();

class Sketch {
    constructor(i = null, scope, size, type = "default") {
        this.i = i;
        this.useScope = scope;
        this.type = type; //U or AI or Main?
        this.svg; //sorted already
        this.elem; //DOM elem
        this.sketchLayer;
        this.frameSize = size;
        // Fixed path list???

        controller.sketches[this.i] = this;
        // console.log("Created: ", this.i);
    }
    load(s, svg, fixed = null, a = true, o = false) {
            //+ SVG Arr
            if (svg === "" || svg === undefined) return;
            this.sketchLayer.clear();
            let importGroup = this.sketchLayer.importSVG(svg);
            let g = importGroup.children[0];
            // if (!(g instanceof Group)) {
            //     g = g.children[0];
            // }
            let scaledGroup = scaleGroup(g, s);
            // if (o) {
            //     scaledGroup.position.x += offX;
            //     scaledGroup.position.y += offY;
            // }
            let finalInserted = this.sketchLayer.insertChildren(
                scaledGroup.index,
                scaledGroup.removeChildren()
            );
            scaledGroup.remove();
            importGroup.remove(); // not g

            if (fixed !== null) {
                for (let i = 0; i < fixed.length; i++) {
                    finalInserted[i].data.fixed = fixed[i];
                }
            }
            // this.sketchLayer.getItems().forEach((path, i) => {
            //     !path.data.fixed && (path.color.alpha *= 0.5);
            // });
            this.svg = this.sketchLayer.project.exportSVG({
                asString: true,
            });

            console.log("LOADED: ", this.sketchLayer);
        }
        // arrange() {
        //     let sorted = [...this.userPathList];
        //     this.sketchLayer.getItems().forEach((item) => {
        //         if (!this.userPathList.includes(item)) {
        //             sorted.push(item);
        //         }
        //         item.remove(); //preserves reference
        //     });
        //     sorted.forEach((elem) => this.sketchLayer.addChild(elem));
        //     this.svg = this.sketchLayer.project.exportSVG({
        //         asString: true,
        //     });
        // }
    renderMini() {
        let domIdx = this.i;

        let newElem = sketchTemplate.cloneNode(reusableExemplar);
        newElem.style.visibility = "initial";

        let sketchCanvas = newElem.querySelector("canvas");
        sketchCanvas.width = sketchSize;
        sketchCanvas.height = sketchSize;
        this.useScope.setup(sketchCanvas);

        if (domIdx !== null) {
            if (this.useScope !== null) {
                this.sketchLayer = this.useScope.projects[domIdx].activeLayer;
            }

            let removeButton = newElem.querySelector(".fa-minus");
            let stopButton = newElem.querySelector(".fa-stop");
            let loader = newElem.querySelector(".card-loading");

            newElem.id = `${this.type}-sketch-item-${domIdx}`;
            sketchCanvas.id = `${this.type}-sketch-canvas-${domIdx}`;
            newElem.querySelector("h3").innerHTML = `${this.type}${domIdx}`;

            if (this.type === "U") {
                stopButton.style.display = "none";
                loader.style.display = "none";
                removeButton.addEventListener("click", () => {
                    newElem.remove();
                });
            } else {
                stopButton.addEventListener("click", () => {
                    loader.classList.remove("button-animation");
                    loader.classList.remove("fa-spinner");
                    loader.classList.add("fa-check");
                    stopButton.style.background = "#f5f5f5";
                    stopButton.style.background = "#d2d2d2";

                    controller.stopSingle(domIdx);
                });
                removeButton.addEventListener("click", () => {
                    newElem.classList.add("inactive-sketch");
                    controller.stopSingle(domIdx);
                });
            }

            sketchCanvas.addEventListener("click", () => {
                // TO DO refactor so class doesn't reference mainSketch???
                if (mainSketch) {
                    this.importTo(mainSketch);
                }
                // controller.resetMetaControls();
            });
            // Make draggable
            newElem.addEventListener(
                "dragstart",
                function(e) {
                    e.dataTransfer.setData("text/plain", domIdx);
                },
                false
            );
        } else {
            newElem.id = `default-sketch-item`;
            sketchCanvas.id = `default-canvas`;
        }

        this.elem = newElem;
        return this.elem;
    }
    overwrite(overwriting, fromLayer, s) {
        if (!fromLayer) return;
        overwriting.sketchLayer.clear();
        fromLayer = scaleGroup(fromLayer, s);
        overwriting.sketchLayer.insertChildren(0, fromLayer.removeChildren());
        fromLayer.remove();
    }
    add(overwriting, fromLayer, s) {
        if (!fromLayer) return;
        fromLayer = scaleGroup(fromLayer, s);
        overwriting.sketchLayer.insertChildren(
            fromLayer.index,
            fromLayer.removeChildren()
        );
        fromLayer.remove();
    }
    importTo(overwriting) {
        let i = this.i;
        if (controller.clipDrawing) {
            openModal({
                title: "Overwriting Canvas",
                message: "This will stop AI drawing. Are you sure?",
                confirmAction: () => {
                    controller.stop();
                    controller.clipDrawing = false;
                    // pauseActiveDrawer();
                    ungroup();
                    this.saveStatic(overwriting.extractScaledSVG(1 / scaleRatio));
                    let fromLayer = controller.sketches[i].sketchLayer.clone();
                    if (fromLayer.firstChild instanceof Group) {
                        fromLayer = fromLayer.children[0];
                    }
                    this.overwrite(overwriting, fromLayer, scaleRatio);
                },
            });
        } else if (controller.allowOverwrite) {
            openModal({
                title: "Overwriting Canvas",
                message: "Import into the main canvas? Sketch will be saved.",
                confirmAction: () => {
                    // pauseActiveDrawer();
                    ungroup(); //remove first even tho deleted
                    this.saveStatic(overwriting.extractScaledSVG(1 / scaleRatio));
                    let fromLayer = controller.sketches[i].sketchLayer.clone();
                    if (fromLayer.firstChild instanceof Group) {
                        fromLayer = fromLayer.children[0];
                    }
                    this.overwrite(overwriting, fromLayer, scaleRatio);
                },
            });
        } else {
            // pauseActiveDrawer();
            ungroup(); //could stay selected but something happens to position when dragging
            mainSketch.sketchLayer.getItems().forEach((path) => {
                path.selected = false;
            });

            this.saveStatic(overwriting.extractScaledSVG(1 / scaleRatio));
            let fromLayer = controller.sketches[i].sketchLayer.clone();
            if (fromLayer.firstChild instanceof Group) {
                fromLayer = fromLayer.children[0];
            }
            this.add(overwriting, fromLayer, scaleRatio);
        }
    }
    clone() {
        let clone = this.sketchLayer.clone({
            insert: false,
        });
        clone.getItems().forEach((path) => {
            path.selected = false;
        });
        return clone;
    }
    extractSVG() {
        return this.clone().exportSVG();
    }
    extractScaledSVG(s) {
        let clone = this.clone();
        let scaledSketch = scaleGroup(clone, s);
        let res = scaledSketch.exportSVG();
        scaledSketch.remove();
        return res;
    }
    saveStatic(sJSON) {
        let sketchCountIndex = controller.sketchScopeIndex;
        let sketch = new Sketch(sketchCountIndex, sketchScope, sketchSize, "U");
        let newElem = sketch.renderMini();
        let toCanvas = sketchScope.projects[sketchCountIndex];
        // change to load??
        toCanvas.activeLayer.importSVG(sJSON);
        newElem.classList.add("bounce");
        document.getElementById("sketch-grid").prepend(newElem);
        controller.sketchScopeIndex += 1;
    }
    buildSketch() {
        let pathList = [];
        this.sketchLayer.getItems((path) =>
            pathList.push({
                color: path.strokeColor.components.length === 4 ? [...path.strokeColor.components] : [...path.strokeColor.components, 1],
                stroke_width: path.strokeWidth,
                path_data: path.pathData,
                fixed_path: path.data.fixed,
            })
        );
        this.sketch = pathList;
        console.log(pathList);
    }
}

mainSketch = new Sketch("main-sketch", scope, frame, "main");
mainSketch.svg = paper.project.exportSVG({
    asString: true,
}); //for svg parsing
mainSketch.sketchLayer = userLayer;
// console.log(userLayer);

sketchHistory = new SketchHistory(mainSketch);