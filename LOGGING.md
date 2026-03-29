# Logging (dev / daily / error)

This repo keeps **local, human-written logs** for:

- **Daily log**: what changed today (features, logic, code, validation)
- **Dev log**: step-by-step notes while implementing/debugging
- **Error log**: issues/bugs with repro steps + fixes/workarounds

Because these are usually personal notes, logs live under `logs/` and are **gitignored** by default.

## Quick start

Create a daily entry (interactive):

```powershell
node scripts/log.mjs daily --interactive
```

Log a bug/error (interactive):

```powershell
node scripts/log.mjs error --interactive
```

Add a quick dev note (non-interactive):

```powershell
node scripts/log.mjs dev --title "Refactor menu nav" --note "Moved Esc behavior into backTarget() and verified pause flow."
```

## Where logs go

- Daily: `logs/daily/YYYY-MM-DD.md`
- Dev: `logs/dev/YYYY-MM-DD.md`
- Errors: `logs/errors/YYYY-MM-DD.md`

## What to record (recommended fields)

### Daily entries

- **Steps**: what you did, in order
- **Methods/Logic**: design decisions and why
- **Code changes**: files touched + key functions
- **Issues/Errors**: anything that broke or was confusing
- **Validation**: tests run + quick manual checks

### Dev entries

- **Context**: what you were trying to achieve
- **Experiments**: what you tried, results, and next step
- **Notes**: TODOs, follow-ups, cleanups

### Error entries

- **Repro steps**
- **Expected vs actual**
- **Environment**: browser/node version if relevant
- **Console/stack trace**
- **Fix/workaround** and how it was verified

## Optional: include git snapshot in the entry

Add `--git` to include `git status` and `git diff --stat` in the log entry (helpful when you want “code changes” captured quickly):

```powershell
node scripts/log.mjs daily --interactive --git
```

