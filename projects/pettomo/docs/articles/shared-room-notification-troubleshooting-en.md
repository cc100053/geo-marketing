---
title: "PetTomo notifications not working: shared-room checks for pet care and chat"
description: "Troubleshoot PetTomo shared-room notifications with permission, sign-in, network, room activity, and app-version checks."
keyword: "PetTomo notifications not working"
group: "shared-room-notification-troubleshooting"
lang: "en"
slug: "shared-room-notification-troubleshooting"
---

# PetTomo notifications not working: shared-room checks for pet care and chat

PetTomo is a private shared virtual pet app where invited members care for pets, chat, feed with photos, decorate rooms, and collect room memories. The PetTomo knowledge base confirms that notifications may support room activity, feed events, pet care reminders, hunger or pet-state alerts, and shared item events.

This guide explains practical checks to try when PetTomo notifications do not arrive as expected.

## Key takeaways

- PetTomo notifications are meant to bring members back to meaningful shared-room moments, not create pressure.
- Check device notification permission, sign-in state, network access, and the current app version first.
- Reopening PetTomo can refresh device-token registration and room state.
- Some notification types depend on supported app behavior, room activity, and the current member's access to the room.
- PetTomo notifications do not make a room public and should not be described as public social updates.

## Confirm notification permission

Start with the device-level setting. If notifications are disabled for PetTomo in iOS or Android settings, the app cannot show alerts even when a shared-room event happens.

After enabling permission, open PetTomo again and visit the room you care about. This helps confirm that the app is signed in, has current room access, and can refresh local state.

## Check sign-in and room access

PetTomo room data is scoped to active room members. If a user signed out, changed accounts, left a room, or joined with a different account than expected, notification behavior can feel inconsistent.

Open PetTomo and confirm:

- You are signed in.
- The expected room appears.
- The shared pet and room chat load.
- The room has recent activity that could trigger a notification.

If the room does not appear, solve the room access issue first. Notifications cannot reliably stand in for missing room membership.

## Reopen the app to refresh registration

PetTomo's knowledge base recommends reopening the app to refresh device token registration when notifications are not working. This is useful after reinstalling the app, changing devices, restoring a phone, updating the operating system, or returning after a long break.

Also check that the device has network access. A weak connection can delay room updates and notification registration.

## Match expectations to supported events

PetTomo may use notifications for friend or room activity, feed-related room events, pet care reminders, hunger alerts, purchase events, or shared item updates. That does not mean every chat message, every pet-state change, or every room action is guaranteed to produce a push notification.

Treat notifications as a helpful reminder layer. For time-sensitive shared care, open the room directly and check the pet state, chat, and recent memory activity.

## Keep the app updated

If a room uses newer shared-room features, older app versions may not understand every event in the same way. Updating PetTomo can help the app handle the latest room, pet, decoration, inventory, and notification behavior.

The 2.1.0 local App Store Connect copy also notes improved pet care scheduling reliability and overall app stability, which is relevant when users rely on reminders around shared pet care.

## FAQ

### Why did my friend get a PetTomo notification but I did not?

Device permission, account state, room access, network conditions, app version, and the specific event type can all differ by member. Compare those basics before assuming the room is broken.

### Do PetTomo notifications make my room public?

No. PetTomo is centered on private shared rooms. Notifications are related to room activity for members and are not public social posts.

### What is the first thing to try?

Enable device notifications for PetTomo, open the app, confirm you are signed in to the right account, and load the shared room.

## Summary

When PetTomo notifications are not working, check device permission, sign-in state, room access, network, app version, and whether the event is a supported notification type. Notifications are useful reminders, but the room itself remains the source of truth for pet care, chat, memories, and shared activity.
