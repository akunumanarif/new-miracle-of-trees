# Dunia Hewan — asset credits

Downloaded 8 November 2026. Models and sounds are served locally; the page does not
depend on third-party asset servers at runtime. The environment, interface,
audio editing and interaction code were made for this project.

## Quaternius animal models — CC0 1.0

License: https://creativecommons.org/publicdomain/zero/1.0/

- `alpaca`, `bull`, `cow`, `deer`, `donkey`, `fox`, `horse`, `husky`, `shibainu`,
  `stag`, `wolf`: Quaternius, Ultimate Animated Animal Pack.
  Original: https://quaternius.com/packs/ultimateanimatedanimals.html
  Downloaded GLBs: https://github.com/danwahl/animasim/tree/main/assets/generated/glb
  These GLBs were reduced to the idle animation used by the page.
- `Llama`, `Pig`, `Pug`, `Sheep`, `Zebra`: Farm Animals Pack by Quaternius.
  https://opengameart.org/content/lowpoly-animated-farm-animal-pack
  OBJ/MTL converted to GLB with Three.js; flat, rough materials.
- `Chick`: Animals Pack by Quaternius.
  https://opengameart.org/content/5-low-poly-animals
  OBJ/MTL converted to GLB; recolored yellow and orange.
- `Bunny`: Quaternius, https://poly.pizza/m/irZjWFARyl

## Other models — Creative Commons Attribution 3.0

License: https://creativecommons.org/licenses/by/3.0/

| Local model | Creator | Original model page |
| --- | --- | --- |
| Lion | Poly by Google | https://poly.pizza/m/3XAJojWxSWz |
| Elephant | Poly by Google | https://poly.pizza/m/a27MA0rXyyj |
| Bear (Black bear) | Poly by Google | https://poly.pizza/m/56ym_pyVnel |
| Tiger | Poly by Google | https://poly.pizza/m/5A3w06FXUup |
| Duck | Poly by Google | https://poly.pizza/m/6HpauUCfIAb |
| Cat | Poly by Google | https://poly.pizza/m/6dM1J6f6pm9 |
| Parrot | Poly by Google | https://poly.pizza/m/dfNjMLtO0pd |
| Flamingo | Хмара Сергей | https://poly.pizza/m/5hUIvLVFqet |
| Stork (White stork) | Gwym Hendawyr | https://poly.pizza/m/aRlrdbGgvQC |

Models are scaled and repositioned in the scene. Static birds are given gentle
flight paths by application code. Embedded textures may be resized for the web.
No endorsement by the original creators is implied.

## Animal recordings — audited replacement, 8 November 2026

All 27 animal buttons use separate, source-verified real recordings. There is no
synthesizer fallback and no reuse of one dog clip for different breeds. A recordist
description naming the animal was required; human imitations and ambiguous animal
identifications were excluded. Each selected MP3 is downloaded and served locally.

Clips retain original pitch and speed. Changes: selected excerpt, conversion to
mono 44.1 kHz MP3, 40 Hz rumble filter, peak normalization, and brief fades.
The exact source excerpt, file hash and processing are recorded in
[audio-recordings.json](audio-recordings.json). Audio ends naturally; it is not
cut off by a shared 7.5-second timer. Ambient forest volume is reduced while an
animal is sounding.

| Animal ID / file | Creator / recordist | Source | License | Excerpt |
| --- | --- | --- | --- | --- |
| `deer` / `deer-recording-v2.mp3` | Sacha.Julien | [Roe deer calls](https://freesound.org/people/Sacha.Julien/sounds/724578/) | [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/) | 21.1s + 1.8s |
| `stag` / `stag-recording-v2.mp3` | naturenotesuk | [Red Deer Stag Bellowing](https://freesound.org/people/naturenotesuk/sounds/757773/) | [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/) | 4.4s + 4.8s |
| `wolf` / `wolf-recording-v2.mp3` | Paresh | [wolves.wav](https://freesound.org/people/Paresh/sounds/158780/) | [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/) | 1.2s + 8.5s |
| `cow` / `cow-recording-v2.mp3` | spurioustransients | [Cow moo #2](https://freesound.org/people/spurioustransients/sounds/513558/) | [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/) | 7.1s + 2.9s |
| `bull` / `bull-recording-v2.mp3` | TheKingOfGeeks360 | [Loud Bellow from Hereford Bull](https://freesound.org/people/TheKingOfGeeks360/sounds/827111/) | [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/) | 0s + 2.88s |
| `alpaca` / `alpaca-recording-v2.mp3` | TheKingOfGeeks360 | [Alpaca; Two Moaning, Close Perspective](https://freesound.org/people/TheKingOfGeeks360/sounds/839099/) | [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/) | 0s + 1.813s |
| `llama` / `llama-recording-v2.mp3` | TheKingOfGeeks360 | [Llama; Burst](https://freesound.org/people/TheKingOfGeeks360/sounds/871455/) | [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/) | 0s + 0.24s |
| `husky` / `husky-recording-v2.mp3` | simcotter | [dog howling.wav](https://freesound.org/people/simcotter/sounds/115357/) | [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/) | 9.3s + 5.8s |
| `shiba` / `shiba-recording-v2.mp3` | NachtmahrTV | [Barking Dog — Shiba Inu](https://freesound.org/people/NachtmahrTV/sounds/553188/) | [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/) | 0.25s + 2.65s |
| `pug` / `pug-recording-v2.mp3` | RICHERlandTV | [Pug Woof 2](https://freesound.org/people/RICHERlandTV/sounds/273688/) | [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/) | 0s + 2.693s |
| `chick` / `chick-recording-v2.mp3` | GB01 | [Chicks Peep](https://freesound.org/people/GB01/sounds/150298/) | [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/) | 1s + 4.5s |
| `parrot` / `parrot-recording-v2.mp3` | OroborosNZ | [Parrots in tree](https://freesound.org/people/OroborosNZ/sounds/141252/) | [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/) | 0.5s + 5.5s |
| `flamingo` / `flamingo-recording-v2.mp3` | InspectorJ | [Flamingo Calls, Ensemble, A.wav](https://freesound.org/people/InspectorJ/sounds/400860/) | [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/) | 8.2s + 4.8s |
| `stork` / `stork-recording-v2.mp3` | dobroide | [20150401_01.storks.flac](https://freesound.org/people/dobroide/sounds/269223/) | [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/) | 6.4s + 5s |
| `tiger` / `tiger-recording-v2.mp3` | lauramellis | [Tiger Roar](https://freesound.org/people/lauramellis/sounds/263115/) | [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/) | 0.8s + 2.8s |
| `duck` / `duck-recording-v2.mp3` | gibarroule | [Duck Quack](https://freesound.org/people/gibarroule/sounds/365133/) | [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/) | 0.3s + 5.8s |
| `cat` / `cat-recording-v2.mp3` | Garuda1982 | [cat meow.wav](https://freesound.org/people/Garuda1982/sounds/477386/) | [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/) | 0s + 5.03s |
| `bunny` / `bunny-recording-v2.mp3` | davi-sh | [A rabbit is eating a cucumber](https://freesound.org/people/davi-sh/sounds/482732/) | [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/) | 5s + 4.5s |
| `fox` / `fox-recording-v2.mp3` | Jugrü | [Bellender_Fuchs.ogg](https://commons.wikimedia.org/wiki/File:Bellender_Fuchs.ogg) | [CC BY-SA 3.0](https://creativecommons.org/licenses/by-sa/3.0/) | 0.45s + 1.25s |
| `horse` / `horse-recording-v2.mp3` | Hü. | [Wiehern.ogg](https://commons.wikimedia.org/wiki/File:Wiehern.ogg) | [Public domain](https://creativecommons.org/publicdomain/mark/1.0/) | 0s + 2.3s |
| `donkey` / `donkey-recording-v2.mp3` | felix-blume | [157763_felix-blume_a-donkey-is-braying-in-his-enclosure-in-south-of-france.wav](https://commons.wikimedia.org/wiki/File:157763_felix-blume_a-donkey-is-braying-in-his-enclosure-in-south-of-france.wav) | [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/) | 3s + 6s |
| `sheep` / `sheep-recording-v2.mp3` | earthcalling; Dcoetzee | [Sheep_bleating.ogg](https://commons.wikimedia.org/wiki/File:Sheep_bleating.ogg) | [Public domain](https://creativecommons.org/publicdomain/mark/1.0/) | 0.45s + 1.65s |
| `pig` / `pig-recording-v2.mp3` | Erdie | [Pig_grunt_-_Erdie.ogg](https://commons.wikimedia.org/wiki/File:Pig_grunt_-_Erdie.ogg) | [CC BY 3.0](https://creativecommons.org/licenses/by/3.0/) | 0s + 0.72s |
| `lion` / `lion-recording-v2.mp3` | த*உழவன் (Info-farmer) | [Lion_raring-sound1TamilNadu178.ogg](https://commons.wikimedia.org/wiki/File:Lion_raring-sound1TamilNadu178.ogg) | [Public domain](https://creativecommons.org/publicdomain/mark/1.0/) | 0.35s + 2.35s |
| `elephant` / `elephant-recording-v2.mp3` | தகவலுழவன் (Info-farmer) | [Elephant_voice_-_trumpeting.ogg](https://commons.wikimedia.org/wiki/File:Elephant_voice_-_trumpeting.ogg) | [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/) | 0s + 1.45s |
| `bear` / `bear-recording-v2.mp3` | U.S. Fish & Wildlife Service; prepared by AntumDeluge | [Bear Growls — bear_01](https://opengameart.org/content/bear-growls) | [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/) | 0s + 1.068s |
| `zebra` / `zebra-recording-v2.mp3` | Peet J van Eeden; prepared by AntumDeluge | [Zebra Whinny](https://opengameart.org/content/zebra-whinny) | [CC BY 3.0](https://creativecommons.org/licenses/by/3.0/) | 0s + 2.229s |

The Freesound sources use their publicly available HQ MP3 previews. License
links and creator credits apply to the recordings, independently of file format.
The adapted fox clip is distributed under CC BY-SA 3.0, matching its source.

The rabbit clip is **chewing**, not a vocal call. The white stork clip is **bill
clattering**. The llama clip is a brief **spitting/snorting** event, as described
by its recordist. These actions are identified in the interface. The other clips
are animal vocalizations; real field recordings can contain a little background
ambience. The three dog clips explicitly identify husky, shiba inu, and pug.

## Ambient forest

`ambience-forest-49.mp3` by SFXMint, [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/).
Source: https://sfxmint.com/sounds/ambience-forest-49

Legacy audio files from the initial implementation are not used by animal buttons.

## Licenses retained with the page

- CC0 1.0: https://creativecommons.org/publicdomain/zero/1.0/
- CC BY 3.0: https://creativecommons.org/licenses/by/3.0/
- CC BY 4.0: https://creativecommons.org/licenses/by/4.0/
- CC BY-SA 3.0: https://creativecommons.org/licenses/by-sa/3.0/

Quixel/Megascans assets are not included. The stylized environment is generated
from original geometry, so the page has no Fab/Epic login dependency.
