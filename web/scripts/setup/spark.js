const spark = new PaperScope();
spark.setup(sparkCanvas);
spark.activate();


const smoothing = 0.98;
const speed = 0.6;
let renderShape, pointA, pointB, sparkPath;

const createSparkShadow = () => {
    if (renderShape) renderShape.remove();
    renderShape = sparkPath.clone();
    renderShape.firstSegment.point.x -= 1.5;

    let bottomLeftPoint = new Point(
        sparkPath.firstSegment.point.x - 1.5,
        spark.view.bounds.bottom
    );
    let bottomRightPoint = new Point(
        spark.view.bounds.right,
        spark.view.bounds.bottom
    );
    let bl = renderShape.insert(0, bottomLeftPoint);
    let br = renderShape.add(bottomRightPoint);
    new Path.Line({ from: bl, to: br }); //connect
    renderShape.set({
        fillColor: {
            gradient: {
                stops: ["#CAA9FF", "#f7f6ff"],
            },
            origin: spark.view.bounds.topCenter,
            destination: spark.view.bounds.bottomCenter,
        },
        strokeColor: null,
    });

    renderShape.sendToBack();
};

const setupSpark = () => {
    if (sparkPath) sparkPath.remove();

    pointA = new Point(0, spark.view.bounds.centerY);
    pointB = new Point(spark.view.bounds.right, spark.view.bounds.centerY);
    sparkPath = new Path({
        strokeColor: "#7B66FF",
        strokeWidth: 3,
        strokeCap: "round",
    });
    sparkPath.add(pointA);
    sparkPath.add(pointB);
    createSparkShadow();
};

setupSpark();

spark.view.onFrame = () => {
    if (
        (controller.drawState === "draw" || controller.drawState === "active-frame") &&
        mainSketch.semanticLoss
    ) {
        let newY = scaleLoss(mainSketch.semanticLoss);
        
        // This is the distance from the "roof". AKA, 100 - a softened value of Y 
        let smoothNegY = Math.floor(sparkPath.lastSegment.point.y*smoothing + (100-newY)*(1-smoothing))
        
        sparkPath.add(new Point(spark.view.bounds.right, smoothNegY));
        sparkKnob.style.top = smoothNegY + "px";
        sparkPath.position.x -= speed;
        createSparkShadow();
        document.querySelectorAll(".spark-val")[1].innerHTML =
            Math.floor(newY);
    }
    mainScope.activate(); //return to main
};