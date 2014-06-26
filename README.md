##Zone

The Zone library provides a way to automatically groups resources and
asynchronous operations that are part of a high-level asynchronous
operations. Such a group can – as a whole – have a callback.

The Zone library provides the following:
 * Automatic resource cleanup and layered exception handling
 * Long stack traces
 * Detection of and handling of common pitfalls with callbacks
 * The association of arbitrary data with asynchronous control flow

From the outside, Zones can return a single value or "throw" a single error.
When a zone reports its outcome:
 * No more callbacks will run inside the zone.
 * All non-garbage-collectable resources will have been cleaned up.
Zones also automatically exit when no explicit value is returned.