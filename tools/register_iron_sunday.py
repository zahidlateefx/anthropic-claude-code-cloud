"""Register the IRON SUNDAY film: scope id, locked character descriptors, recurring locations.

Idempotent: re-running it overwrites only the iron-sunday entries.
Run:  C:\\Users\\Zahid\\VideoReferenceLab\\.venv\\Scripts\\python.exe tools\\register_iron_sunday.py
"""
import json
import pathlib

ROOT = pathlib.Path(__file__).resolve().parent.parent

CHARACTERS = {
    "organist": {
        "name": "THE ORGANIST",
        "descriptor": (
            "THE ORGANIST, a very tall very thin masked gunman whose face is completely hidden "
            "behind a riveted iron grille-mask with one narrow horizontal slit, wearing a scorched "
            "ankle-length black cassock, a rust-pitted iron collar plate across the shoulders, "
            "dusty boots without spurs, with bare burn-scarred four-fingered hands and no gloves, "
            "carrying two sawn-off shotguns"
        ),
        "tag": "@ORGANIST",
        "height": "about 2.2 m, very tall",
        "film": "iron-sunday",
        "rules": [
            "never speaks and never makes a voice sound",
            "never runs; he walks while everyone else runs",
            "his face is never shown in any episode before the final one",
        ],
    },
    "pike": {
        "name": "SISTER PIKE",
        "descriptor": (
            "SISTER PIKE, a squat armadillo nun with banded grey-brown plates down her back over a "
            "faded black habit, a white coif grey with dust, a belt of six red dynamite sticks at "
            "the waist, and a long iron key-chain held in her right hand"
        ),
        "tag": "@PIKE",
        "height": "about 1.5 m",
        "film": "iron-sunday",
    },
    "choir": {
        "name": "THE CHOIR",
        "descriptor": (
            "THE CHOIR, small toad-gunmen with wide flat olive heads, huge wet yellow eyes set wide "
            "apart and torn white-and-grey choir robes over gun belts, each carrying a different "
            "mismatched weapon"
        ),
        "tag": "@CHOIR",
        "height": "about 0.7 m each",
        "film": "iron-sunday",
        "rules": [
            "comic chorus: they turn their heads in unison, blink in unison",
            "they copy the ORGANIST's gestures one beat late and wrong",
            "six in EP01; two survive and continue through the series",
        ],
    },
    "caldera": {
        "name": "BOSS CALDERA",
        "descriptor": (
            "BOSS CALDERA, a heavy gila-monster outlaw with beaded black-and-orange hide, a flat "
            "broad head, a flicking tongue, a grin of gold teeth, a heavy silver cross on a chain "
            "at the neck, a long grey duster and two long-barrel revolvers"
        ),
        "tag": "@CALDERA",
        "height": "about 2.4 m, the tallest",
        "film": "iron-sunday",
        "episodes": ["ep01"],
    },
    "caldera_riders": {
        "name": "CALDERA'S RIDERS",
        "descriptor": (
            "CALDERA'S RIDERS, nine mixed creature gunmen (a rattlesnake, a buzzard, a boar, a "
            "jackrabbit, two lizards and three coyotes) in grey dusters and flat black hats, "
            "carrying mismatched rifles and sawn-off shotguns"
        ),
        "tag": "@RIDERS",
        "height": "1.6 m to 2.1 m",
        "film": "iron-sunday",
        "episodes": ["ep01"],
    },
    "dusthorse": {
        "name": "DUST-HORSE",
        "descriptor": (
            "a DUST-HORSE, a gaunt long-legged reptilian horse-creature with grey leathery hide, no "
            "mane, bone ridges down the neck, split-claw hooves, a worn western saddle and "
            "saddlebags"
        ),
        "tag": "@DUSTHORSE",
        "height": "about 2.2 m at the head",
        "film": "iron-sunday",
        "sound": (
            "split-claw hooves hitting hard dry ground in a fast four-beat, leather saddle creak, "
            "snorting breath"
        ),
    },
    "hovertruck": {
        "name": "HOVER-TRUCK",
        "descriptor": (
            "a HOVER-TRUCK, a rusty flatbed hover-truck with a riveted boiler body, two glowing "
            "orange thruster pods underneath, a scrap-iron cab with no doors and barrels roped to "
            "the bed"
        ),
        "tag": "@TRUCK",
        "height": "about 4 m long, floating just above the ground",
        "film": "iron-sunday",
        "sound": (
            "a deep diesel-generator drone with a rattling loose body panel, a hissing pressure "
            "valve, and a low bass thrum that rises and falls with distance"
        ),
    },
}

LOCATIONS = {
    "iron_mission": {
        "name": "THE IRON MISSION",
        "descriptor": (
            "THE IRON MISSION, a small crumbling off-world desert mission church of cracked pale "
            "adobe patched with rusty corrugated iron and warped grey planks, a square bell tower "
            "with a cracked bronze bell, a sagging tiled roof, bullet holes across the front wall, "
            "a dry cracked yard littered with bones and blown rubbish, and rust-red mesas beyond "
            "under two pale moons"
        ),
        "tag": "@MISSION",
        "film": "iron-sunday",
        "recurring": True,
    },
    "crypt": {
        "name": "THE CRYPT",
        "descriptor": (
            "THE CRYPT, a low stone burial chamber under the mission floor lit by one amber "
            "lantern, with damp pitted walls, a packed dirt floor, and twelve names cut in rough "
            "capitals into one flat stone wall"
        ),
        "tag": "@CRYPT",
        "film": "iron-sunday",
        "recurring": True,
        "note": "the closing shot of every episode; one name is scratched through per episode",
    },
}


def merge(path, key, additions):
    data = json.loads(path.read_text(encoding="utf-8"))
    data.setdefault(key, {}).update(additions)
    path.write_text(json.dumps(data, indent=1, ensure_ascii=False), encoding="utf-8")
    return sorted(additions)


def main():
    added_c = merge(ROOT / "bible" / "characters.json", "characters", CHARACTERS)
    added_l = merge(ROOT / "bible" / "locations.json", "locations", LOCATIONS)

    scope_path = ROOT / "SCOPE_FILMS.json"
    scope = json.loads(scope_path.read_text(encoding="utf-8"))
    films = scope.setdefault("films", [])
    if "iron-sunday" not in films:
        films.append("iron-sunday")
    scope_path.write_text(json.dumps(scope, ensure_ascii=False), encoding="utf-8")

    print("characters added:", added_c)
    print("locations added:", added_l)
    print("films:", films)


if __name__ == "__main__":
    main()
