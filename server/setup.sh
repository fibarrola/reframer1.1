#!/bin/bash
conda update -n base -c defaults conda
conda create -n conda_env python=3.8 -y -y
conda activate conda_env
conda install --file requirements.txt
python3 -m venv env
source env/bin/activate
pip install -r requirements.txt
mkdir results
mkdir tmp
source ./activate.sh