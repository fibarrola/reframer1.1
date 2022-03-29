from fastapi import FastAPI, WebSocket
import skimage
import numpy as np
import logging
import json
from class_interface import Clip_Class
from plot_util import plot_cosines, plot_zero_shot_images, plot_image

# check environment var
# add filename='logs.log'
logging.basicConfig(encoding='utf-8', level=logging.DEBUG, format=f'APP LOGGING: %(levelname)s %(name)s %(threadName)s : %(message)s')

app = FastAPI(title = "Clip Draw Backend")
clip_class = Clip_Class()
clip_class.create_clip_draw(False) #encode nouns or nah

@app.get("/classify_dataset")
def classify_dataset():
    """Requires at least one image for each class so an image is classifed"""
    clip_class.set_image_descriptions({
    "cat": "a facial photo of a tabby cat",
    "astronaut": "a portrait of an astronaut with the American flag",
    "rocket": "a rocket standing on a launchpad",
    # "page": "a page of text about segmentation",
    # "motorcycle_right": "a red motorcycle standing in a garage",
    # "camera": "a person looking at a camera on a tripod",
    # "horse": "a black-and-white silhouette of a horse", 
    # "coffee": "a cup of coffee on a saucer"
    })
    clip_class.prepare_images("data/local_images", True, False) # or skimage.data_dir
    image_features = clip_class.encode_image_tensors(np.stack(clip_class.images_rgb)) 
    text_features = clip_class.encode_text_classes(["This is " + desc for desc in clip_class.classes])
    clip_class.calc_cosine_similarities_for_text(text_features, image_features, False)
    plot_cosines(clip_class)
    return {"Hello": "World"}

@app.get("/classify_zero_shot_dataset")
def classify_zero_shot_dataset():
    """Classify as many images as you like. Optionally set the number of classes, or a list of nouns???"""
    clip_class.prepare_images("data/local_images", False, True) # or skimage.data_dir
    image_features = clip_class.encode_image_tensors(np.stack(clip_class.images_rgb)) 
    text_features = clip_class.encode_text_classes(["This is " + desc for desc in clip_class.classes])
    clip_class.calc_cosine_similarities_for_text(text_features, image_features, True)
    plot_zero_shot_images(clip_class)
    return {"Hello": "World"}

@app.get("/classify_zero_shot_image")
def read_item(target: str = "cat"):
    image_path = f"data/local_images/single_images/{target}.jpg"
    clip_class.prepare_single_image(image_path) # or skimage.data_dir
    image_features = clip_class.encode_image_tensors(np.stack(clip_class.images_rgb)) 
    text_features = clip_class.encode_text_classes(["This is " + desc for desc in clip_class.classes])
    clip_class.calc_cosine_similarities_for_text(text_features, image_features, True)
    plot_zero_shot_images(clip_class)
    return {"Hello": target}

@app.get("/classify_text/directory/{prompt}")
def classify_text_from_image(prompt: str):
    prompt = prompt.replace('-', ' ')
    clip_class.prepare_images(skimage.data_dir, False, False) # or skimage.data_dir
    text_features = clip_class.encode_text_classes([prompt])
    image_features = clip_class.encode_image_tensors(np.stack(clip_class.images_rgb)) 
    clip_class.calc_cosine_similarities_for_image(text_features, image_features, True)
    
    image_values = clip_class.similarity[0].tolist()
    top_index = np.argsort(image_values)[-1:][0]
    top_image = clip_class.unprocessed_images[top_index]
    plot_image(top_image)
    return {"Hello": "{prompt}"}

@app.get("/activate_clip_draw/")
def activate_clip_draw():
    prompts = ['A drawing of a red chair.']
    neg_prompts = ['A badly drawn sketch.', 'Many ugly, messy drawings.']
    clip_class.start_clip_draw(prompts, False, neg_prompts);
    return {"Hello": "World"}

@app.get("/")
async def get():
    return {"Hello": "World"}

@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await websocket.accept()
    while True:
        data = await websocket.receive_text()
        data = json.loads(data)
        
        # Right the paths to file
        if data["type"] == "paths":
            svg_string = data["content"]
            clip_class.clip_draw_optimiser.svg_string = svg_string
            # can also triggure clip draw from here

        # Get the user prompt
        if data["type"] == "message":
            content = data["content"] # could refactor to include pos and neg prompt or array of prompts
            logging.info(f"Setting clip prompt: {content}")        
            try:
                clip_class.start_clip_draw([content], True) # optional args
                logging.info("Clip drawer initialised")
            except:
                logging.error("Failed to start clip draw")

            return_msg = json.dumps({
                "type": "message",
                "content": f"{content}"
            })
            await websocket.send_text({return_msg})
            logging.info(f"Ready to draw: {content}")

            iteration = 0
            #only if is_active is true
            while clip_class.clip_draw_optimiser.is_active:
                # Run the optimisation loop and update the data here so it can be sent over socket.
                path_data = clip_class.clip_draw_optimiser.run_draw_iteration(iteration)
                # if path_data != None:
                #     send_paths_to_client = json.dumps({
                #         "type": "paths",
                #         "content": "hello"
                #     })
                #     await websocket.send_text(send_paths_to_client)
                iteration += 1
                # logging.info("Sent paths through socket")


