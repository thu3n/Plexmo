I need help fixing two specific issues in my application related to rule enforcement and notifications.

### Context
The application monitors Plex streams and terminates them based on specific rules (e.g., concurrent streams or scheduled access). It uses Discord for notifications.

---

### Issue 1: UI/Persistence Bug
**Problem:** The "Enable Discord Notifications" setting is not saved when creating a new rule.
**Behavior:**
1. I create a new rule and check "Enable Discord".
2. After saving, the rule is created, but Discord notifications are disabled.
3. **Workaround:** I have to edit the rule again to manually re-enable Discord notifications.

---

### Issue 2: Notification Loop / Duplicate Events
**Problem:** Rules are triggering multiple times for a single event, causing spam in both the terminal logs and Discord. This appears to affect both "Concurrent Stream" rules and "Scheduled Access" rules.

**Observations:**
* This happens in the production build but **does not** happen when running `npm run dev`.
* A single violation results in 3 separate termination attempts and 3 separate Discord messages.

#### Evidence A: Concurrent Streams (Rule: Max 1 stream)
*Terminal Log (shows 3 terminations for the same user/stream):*
```text
[Enforcement] Rule "Rule 1 stream" terminating f9fvc0ov66fkxbknpwnsk2zd for plexserverse
[Enforcement] Rule "Rule 1 stream" terminating 50 for plexserverse
[Enforcement] Rule "Rule 1 stream" terminating 50 for plexserverse
Terminal Log:
Discord Log (shows 3 messages at 20:21):

Stream Terminated. Reason: Rule "Rule 1 stream": maxtillåten 1 stream

Stream Terminated. Reason: Rule "Rule 1 stream": maxtillåten 1 stream

Stream Terminated. Reason: Rule "Rule 1 stream": maxtillåten 1 stream

Evidence B: Scheduled Access (Rule: No allow)
[Scheduled Access] Rule "no allow" blocking plexserverse (1 sessions)
[Scheduled Access] Rule "no allow" blocking plexserverse (1 sessions)
[Scheduled Access] Rule "no allow" blocking plexserverse (1 sessions)
Discord Log:

Stream Terminated. Reason: Rule "no allow": inte tillåtet att straem a nu

Stream Terminated. Reason: Rule "no allow": inte tillåtet att straem a nu

Stream Terminated. Reason: Rule "no allow": inte tillåtet att straem a nu

Fix Issue 1: Ensure the boolean value for Discord notifications is correctly passed and saved during the initial rule creation.

Fix Issue 2: Investigate why the enforcement logic is running in a loop or triggering multiple times per check cycle in production. It seems like the state isn't updating fast enough, or the interval is too aggressive compared to the kill command response time.