# Upstream - draw's correspondence with the projects whose components it takes or shapes

What draw sends to the projects that hold mission-kit components draw takes or helps adjust, and what it has received from them (`dev/DECISIONS.md` H31-1).\
It is tracked in git because it is the channel: the other projects read what draw sent at its commit, and draw's rulings cite it.\
The layout is zorg's own (its `upstream` folder's README), so the two read each other's correspondence the same way.

- **Outgoing.** A file draw writes is committed by its explicit path; its status line says whether it is a draft or was sent by the director's decision. A sent file is copied into the other project's `upstream/incoming/`, where that project's director accepts it.
- **Incoming.** Another project writes its drafts for draw into `upstream/incoming/`, which git ignores, so a draft never enters draw's history by accident.
- **Received.** When the director accepts an incoming draft, draw commits a copy here, its file named as the sender named it, in a commit saying it was received; the copy is never edited, and draw answers it in a file of its own.

One move of H31's plan is one ruling (H31-1): a request is sent only once the director has ruled on it, and its status line names that ruling.
