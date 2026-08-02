# Third-party notices

TypeMore itself is MIT licensed (see `LICENSE`). Some bundled assets are not
original to this project and carry their own terms; they are listed here.

## Typing sound packs

`public/static/sounds/keys/**` and `public/static/sounds/error/**`

Taken from **monkeytype** (<https://github.com/monkeytypegame/monkeytype>),
which is licensed under the **GNU General Public License v3.0**.

Copied from `frontend/static/sounds/`. Only the packaging changed: upstream
keys each pack by number (`click19`, `error4`), so the directories were renamed
to the display names monkeytype itself uses for them
(`frontend/src/ts/config/metadata.tsx`, `playSoundOnClick.optionsMetadata` and
`playSoundOnError.optionsMetadata`) and the samples renumbered `1.wav`…`N.wav`.
The audio is unmodified.

| directory | upstream | name |
| --- | --- | --- |
| `keys/click` | `click1` | click |
| `keys/beep` | `click2` | beep |
| `keys/pop` | `click3` | pop |
| `keys/nk-creams` | `click4` | nk creams |
| `keys/typewriter` | `click5` | typewriter |
| `keys/osu` | `click6` | osu |
| `keys/hitmarker` | `click7` | hitmarker |
| `keys/fist-fight` | `click14` | fist fight |
| `keys/rubber-keys` | `click15` | rubber keys |
| `keys/fart` | `click16` | fart |
| `keys/akko-lavenders` | `click17` | akko lavenders |
| `keys/cherrymx-black-abs` | `click18` | cherrymx black abs |
| `keys/cherrymx-black-pbt` | `click19` | cherrymx black pbt |
| `keys/cherrymx-blue-abs` | `click20` | cherrymx blue abs |
| `keys/cherrymx-blue-pbt` | `click21` | cherrymx blue pbt |
| `keys/cherrymx-brown-pbt` | `click22` | cherrymx brown pbt |
| `keys/kailh-box-white` | `click23` | kalih box white |
| `keys/razer-green` | `click24` | razer green |
| `keys/tealios-v2` | `click25` | tealios v2 |
| `keys/trust-gxt` | `click26` | trust gxt |
| `error/damage` | `error1` | damage |
| `error/triangle` | `error2` | triangle |
| `error/square` | `error3` | square |
| `error/missed-punch` | `error4` | missed punch |

**Note on licence compatibility.** GPL-3.0 is a copyleft licence and MIT is not.
Redistributing these files as part of an MIT-licensed work is very likely
incompatible with their terms. Several packs are also recordings of specific
keyboards (Cherry MX, Akko, Tealios, Kailh, Razer, Trust) whose original source
and terms could not be determined from the monkeytype repository. This was
raised before the files were added and the decision to include them was taken
deliberately; the record is here so it can be revisited.
