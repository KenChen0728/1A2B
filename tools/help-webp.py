# 把 tools/make-help.js 產生的截圖轉成說明用的 help/*.webp
from PIL import Image
import glob, os
here = os.path.dirname(os.path.abspath(__file__))
out = os.path.join(here, '..', 'help')
os.makedirs(out, exist_ok=True)
for f in sorted(glob.glob(os.path.join(here, 'shots', 'help', '*.png'))):
    n = os.path.basename(f)[:-4]
    Image.open(f).convert('RGB').resize((640, 360), Image.LANCZOS).save(os.path.join(out, n + '.webp'), 'WEBP', quality=78, method=6)
