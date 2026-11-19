# Programme prompt for REP

Copy everything inside the box below into any LLM chat. Then paste your goals, constraints, the previous programme and REP's latest CSV export where shown. The LLM plans the programme and outputs a JSON file in the format REP imports (schema version **1.1**). Save its output as a `.json` file and import it under **Programmes → Import**.

You can also use it only to convert a programme you already have. Paste the programme and say "convert only, don't change the training".

REP checks the file strictly. If something is wrong, the import screen names the field, for example `programme.templates[2].exercises[0].track`. Paste that error back into the same chat and ask for a corrected file.

---

````text
You are helping me plan a training programme and export it as a JSON file for my lifting log app, REP. Do two things:

1. PLAN (skip if I say "convert only")
   - Use my goals, constraints, previous programme and training data below.
   - Each training day is one "template" with its own warm-up and warm-down, written as short plain-English instructions (e.g. "5 min easy row, 2×10 band pull-aparts, 10 world's greatest stretch each side"). Warm-ups and warm-downs are NOT exercises. Do not put them in "exercises".
   - Strength work uses a rep range (target_reps_min to target_reps_max). I progress load when I hit the top of the range at a low RPE, so pick ranges that make that meaningful.
   - Cardio and Hyrox-style work goes in "exercises" as "kind": "cardio" stations (see rules below). A circuit or multi-station block is several stations sharing one superset_group, and target_sets is the number of rounds.
   - Read my training data: the CSV has rpe (1–10, per exercise per session), exercise_note and session_note columns. Treat a low RPE at the top of the range as ready to progress, and RPE 9–10 or notes like "felt off" / "poor form" as hold or repeat. Say briefly, outside the JSON, what you changed and why. Then give the JSON on its own.

2. EXPORT
   Output the programme as JSON matching this exact schema. Put the JSON in a single code block, with no comments inside it.

{
  "schema_version": "1.1",
  "programme": {
    "name": "Hybrid Block — Jan",
    "notes": "Strength 3x/week plus one Hyrox conditioning day.",
    "templates": [
      {
        "name": "PUSH + ABS",
        "day_hint": "Tuesday",
        "warm_up": "5 min easy bike. 2×15 band pull-aparts. 2×10 push-ups. 1 light set of the first press.",
        "warm_down": "Doorway pec stretch 2×30s each side. Dead hang 2×30s.",
        "exercises": [
          {
            "name": "Incline Dumbbell Press",
            "kind": "strength",
            "muscle_group": "Chest",
            "load_convention": "per_side",
            "target_sets": 4,
            "target_reps_min": 6,
            "target_reps_max": 10,
            "superset_group": null,
            "notes": ""
          }
        ]
      },
      {
        "name": "HYROX CONDITIONING",
        "day_hint": "Saturday",
        "warm_up": "10 min easy jog. Leg swings 10 each way. 3×20m skips.",
        "warm_down": "5 min walk. Hip flexor and calf stretch 2×30s each side.",
        "exercises": [
          {
            "name": "Run",
            "kind": "cardio",
            "muscle_group": "Conditioning",
            "load_convention": "bodyweight",
            "track": ["distance_m", "time"],
            "target_sets": 4,
            "target_distance_m": 1000,
            "superset_group": "A",
            "notes": "Race pace minus 10s/km"
          },
          {
            "name": "Wall Balls",
            "kind": "cardio",
            "muscle_group": "Conditioning",
            "load_convention": "total",
            "track": ["reps", "load_kg", "time"],
            "target_sets": 4,
            "target_reps_min": 20,
            "target_reps_max": 20,
            "target_load_kg": 6,
            "superset_group": "A",
            "notes": "Unbroken if possible"
          },
          {
            "name": "Sled Push",
            "kind": "cardio",
            "muscle_group": "Conditioning",
            "load_convention": "total",
            "track": ["distance_m", "load_kg", "time"],
            "target_sets": 3,
            "target_distance_m": 50,
            "target_load_kg": 102,
            "superset_group": null,
            "notes": "Load includes the sled"
          },
          {
            "name": "SkiErg",
            "kind": "cardio",
            "muscle_group": "Conditioning",
            "load_convention": "bodyweight",
            "track": ["calories", "time"],
            "target_sets": 5,
            "target_calories": 15,
            "superset_group": null,
            "notes": "1 min rest between rounds"
          }
        ]
      }
    ]
  }
}

FIELD RULES
Programme
- schema_version: exactly "1.1".
- programme.name: required. programme.notes: optional string.
- programme.templates: required, at least one.

Template (one training day)
- name: required. day_hint: optional (e.g. "Monday", "Day 3").
- warm_up, warm_down: optional plain-text instructions, shown on screen and not tracked. Use null or leave them out if there are none.
- exercises: required, at least one, in the order they are performed.

Every exercise
- name: required. Keep the names I use. Don't rename or standardise them. Use the same name for the same movement on every day.
- kind: "strength" or "cardio". Leaving it out means "strength".
- muscle_group: one of Chest, Back, Shoulders, Biceps, Triceps, Legs, Core, Forearms, Neck, Conditioning. Use Conditioning for all cardio stations.
- load_convention: one of per_side, total, bodyweight.
    per_side = dumbbells, kettlebells in each hand, single-arm cable or machine work (logged weight is per hand or per side)
    total = barbells, machines, sleds, wall balls, sandbags (logged weight is the whole load)
    bodyweight = no external load (running, rowing, SkiErg, burpees, pull-ups)
- target_sets: required positive integer. For cardio, this is the number of rounds.
- superset_group: any short string shared by exercises done back-to-back as a superset or circuit; otherwise null.
- notes: optional string (tempo, rest, cues, pace).

Strength exercises
- target_reps_min, target_reps_max: required positive integers, min ≤ max. Make them equal for a fixed target ("4 x 8" → 8 and 8). Convert "4 x 6-10" into target_sets 4, target_reps_min 6, target_reps_max 10.

Cardio exercises
- track: required, non-empty list of what I record each round. Any of:
    "distance_m"  metres covered
    "time"        time taken (I time each round with the app's lap timer)
    "reps"        repetitions (wall balls, burpees)
    "calories"    machine calories (SkiErg, rower, bike)
    "load_kg"     weight used, in kg
- Per-round targets, each optional. Include the ones that match track:
    target_distance_m (positive number), target_time_seconds (positive integer),
    target_calories (positive integer), target_load_kg (positive number),
    target_reps_min + target_reps_max (positive integers, both or neither, only if "reps" is tracked).
- A target needs its matching track entry: target_distance_m needs "distance_m", target_time_seconds needs "time", target_calories needs "calories", target_load_kg needs "load_kg", reps targets need "reps".
- Standard Hyrox stations, as a guide: SkiErg 1000m (distance_m, time), Sled Push 50m (distance_m, load_kg, time), Sled Pull 50m (distance_m, load_kg, time), Burpee Broad Jumps 80m (distance_m, time), Row 1000m (distance_m, time), Farmers Carry 200m (distance_m, load_kg, time; per_side), Sandbag Lunges 100m (distance_m, load_kg, time; total), Wall Balls 100 reps (reps, load_kg, time), Run 1000m between stations (distance_m, time).

Units: kg and metres only. All numbers must be plain JSON numbers, not strings.

MY GOALS AND CONSTRAINTS
[paste: goals, training days per week, session length, equipment, injuries or exercises to avoid, race date if any]

MY PREVIOUS PROGRAMME (optional)
[paste]

MY TRAINING DATA (optional)
[paste the CSV from REP → Export, or a date range of it]
````
