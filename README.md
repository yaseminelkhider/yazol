# Ya Zol — set-up guide (about 10 minutes, once)

You get two links at the end:
- **Game link** for the group chat
- **Results link** for you only (password protected): men and women listed
  separately, with each student's suggested role

Everything lives in **your Google account**. No other hosting is needed.

Files in this folder:
```
Code.gs      the server code (saves answers, checks the password)
index.html   the game
admin.html   your results page
```

## Step 1 — Create the sheet
1. On a computer, go to **sheets.new** (signed in to the Google account you want to use).
2. Rename it (top left) to **Ya Zol Roles**.

## Step 2 — Add the code
1. In the sheet: **Extensions → Apps Script**. A new tab opens.
2. You see a file **Code.gs** with a few lines. Delete them all, then open
   `Code.gs` from this folder (Notepad / TextEdit), copy everything, paste it in.
3. Click the **+** next to "Files" → **HTML** → name it exactly `index`
   (Google adds .html). Delete what's inside, paste all of `index.html`.
4. Again **+** → **HTML** → name it exactly `admin`. Paste all of `admin.html`.
5. Press **Save** (the disk icon, or Ctrl+S / Cmd+S).

## Step 3 — Run setup once
1. At the top, in the function dropdown, choose **setup** → press **Run**.
2. Google asks for permission: **Review permissions** → choose your account →
   **Advanced** → **Go to Ya Zol (unsafe)** → **Allow**.
   (Google shows "unsafe" for every personal script. It's your own code.)
3. Back in the sheet you now have the tabs **Responses**, **History** and **Summary**.

## Step 4 — Publish
1. Top right: **Deploy → New deployment**.
2. Click the gear ⚙ next to "Select type" → **Web app**.
3. Set:
   - Execute as: **Me**
   - Who has access: **Anyone**
4. **Deploy** → copy the **Web app URL** (ends with `/exec`).

## Your two links
- **Game (send to the group):** the URL as it is, e.g.
  `https://script.google.com/macros/s/AKfy…/exec`
- **Results (only you):** the same URL plus `?page=admin`, e.g.
  `https://script.google.com/macros/s/AKfy…/exec?page=admin`

**Results password:** `zol-JXfSXM5xC4iT`

Test once: play the game with a fake student number (e.g. 99999), check it
appears on the results page, then delete that row in the **Responses** tab.

## If you change the code later
**Deploy → Manage deployments → ✏️ Edit → Version: New version → Deploy.**
The links stay the same.

## What's protected
- The sheet is private to you. Students can only add their own answers.
- The results password is stored only as a hash; 10 wrong tries locks the page for 15 minutes.
- Every answer is checked on the server (lengths, allowed values, digits-only student number);
  anything that could act as a spreadsheet formula is neutralised.
- Max 5 submissions per student number per hour; a cap on total traffic.
- If a student plays again, their old row is copied to **History** first.
- Students must tick a consent box before submitting.

To change the password, ask Claude for a new one (it gives you the password and
its hash to put in `ADMIN_KEY_SHA256` in Code.gs).

## Reading results
- **Results link:** two columns, Men and Women. Each card shows the suggested team,
  the second team, organizer score (yellow = 5+ out of 7, a strong organizer),
  the team they'd pick, hours per week and skills. Filter by team, search, sort.
- **Summary tab** in the sheet: men / women / total per team.
