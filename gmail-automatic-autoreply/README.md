# Gmail Automatic Autoreply

Automatically enables and disables your Gmail vacation responder based on "Out of office" events in Google Calendar. Runs as a Google Apps Script with a daily time-based trigger — no server, no credentials file, no OAuth setup required.

## How it works

A daily trigger calls `sync()`, which:

1. Fetches all-day "Out of office" events from your primary Google Calendar (up to 90 days ahead, with recursive window extension for events near the boundary)
2. Fuses overlapping OOO intervals into a single period
3. Extends the interval end to the day before the first working day after the last OOO day — so a Friday absence keeps the responder active through the weekend
4. Pre-configures Gmail's vacation responder with the correct start and end dates — Gmail handles activation/deactivation automatically
5. Sends you a confirmation email whenever the responder is updated or disabled
6. Sends you an error email (and re-throws) if anything goes wrong

## Setup

### 1. Create an Apps Script project

1. Go to [script.google.com](https://script.google.com) and click **New project**
2. Delete the default `Code.gs` content

### 2. Copy the script files

Copy the contents of each `.gs` file from this repo into the Apps Script editor:

| File | How to add |
|---|---|
| `Config.gs` | Rename the default `Code.gs` file, or add a new file |
| `CalendarWatcher.gs` | **+** → Script → name it `CalendarWatcher` |
| `GmailManager.gs` | **+** → Script → name it `GmailManager` |
| `Code.gs` | **+** → Script → name it `Code` |

Paste the file contents into each corresponding editor tab.

### 3. Apply the manifest (`appsscript.json`)

The manifest configures OAuth scopes and enables the Advanced Calendar API — no separate UI steps needed for that.

1. Click the gear icon (**Project Settings**) in the left sidebar
2. Check **"Show 'appsscript.json' manifest file in editor"**
3. Open the `appsscript.json` tab that appears in the editor
4. Replace its entire contents with the `appsscript.json` from this repo

Saving the manifest automatically enables the Calendar API on the default GCP project.

### 4. Configure

Open `Config.gs` and edit the constants at the top:

- `AUTOREPLY_MESSAGE_TEMPLATE` — the message your correspondents will receive. Use `{return_date}` as a placeholder for your last OOO day (e.g. `May 22, 2026`).
- `LOOKAHEAD_DAYS` — how many days ahead to scan for OOO events (default: 90).

### 5. Run once manually

In the Apps Script editor, select the `sync` function from the dropdown and click **Run**. Accept the permission prompts. Check that it runs without errors in the **Execution log**.

### 6. Add a daily trigger

1. Click the clock icon (**Triggers**) in the left sidebar
2. Click **+ Add Trigger** (bottom right)
3. Set: function = `sync`, event source = **Time-driven**, type = **Day timer**, time = any hour you prefer
4. Click **Save**

That's it. The script will run daily and keep your Gmail vacation responder in sync with your calendar.

## Disabling

To stop the automation:

1. Remove the trigger (Triggers → hover over it → delete)
2. Optionally run `disableAutoreply()` manually to clear any active responder

## Notes

- Only events of type **Out of office** (created via Google Calendar's "Out of office" event type) are detected. Regular events with "OOO" in the title are not picked up.
- The responder stays active through the weekend after a Friday (or multi-day) OOO — it is disabled on the first working day you are back.
- The `{available_date}` placeholder in the message resolves to the first working day after the last OOO day (e.g. Friday OOO → Monday date).
- If you manually change your Gmail vacation responder between runs, the next daily trigger will restore the script-managed state.
- The script sends you an email whenever it makes a change or encounters an error. If the state is already correct it runs silently.
