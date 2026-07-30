import { Schema } from "effect"

const Href = Schema.Struct({
  html: Schema.optional(
    Schema.Struct({
      href: Schema.optional(Schema.String)
    })
  )
})

export const Repository = Schema.Struct({
  slug: Schema.String,
  name: Schema.String,
  description: Schema.optional(Schema.NullOr(Schema.String)),
  is_private: Schema.optional(Schema.Boolean),
  updated_on: Schema.optional(Schema.NullOr(Schema.String)),
  links: Schema.optional(Href)
})

export const Branch = Schema.Struct({
  name: Schema.String,
  target: Schema.optional(
    Schema.Struct({
      hash: Schema.optional(Schema.String)
    })
  )
})

export const Author = Schema.Struct({
  display_name: Schema.optional(Schema.String),
  account_id: Schema.optional(Schema.String)
})

export const Reviewer = Schema.Struct({
  display_name: Schema.optional(Schema.String),
  account_id: Schema.optional(Schema.String),
  approved: Schema.optional(Schema.Boolean)
})

export const PullRequest = Schema.Struct({
  id: Schema.Number,
  title: Schema.String,
  description: Schema.optional(Schema.NullOr(Schema.String)),
  state: Schema.optional(Schema.String),
  author: Schema.optional(Author),
  reviewers: Schema.optional(Schema.Array(Reviewer)),
  created_on: Schema.optional(Schema.NullOr(Schema.String)),
  updated_on: Schema.optional(Schema.NullOr(Schema.String)),
  links: Schema.optional(Href)
})

export const Commit = Schema.Struct({
  hash: Schema.String,
  message: Schema.optional(Schema.String),
  author: Schema.optional(
    Schema.Struct({
      raw: Schema.optional(Schema.String),
      user: Schema.optional(Author)
    })
  ),
  date: Schema.optional(Schema.String)
})

export const DiffstatEntry = Schema.Struct({
  status: Schema.optional(Schema.String),
  lines_added: Schema.optional(Schema.Number),
  lines_removed: Schema.optional(Schema.Number),
  new: Schema.optional(
    Schema.NullOr(Schema.Struct({ path: Schema.optional(Schema.String) }))
  ),
  old: Schema.optional(
    Schema.NullOr(Schema.Struct({ path: Schema.optional(Schema.String) }))
  )
})

export const Comment = Schema.Struct({
  id: Schema.Number,
  user: Schema.optional(Author),
  content: Schema.optional(
    Schema.Struct({ raw: Schema.optional(Schema.String) })
  ),
  created_on: Schema.optional(Schema.String),
  updated_on: Schema.optional(Schema.NullOr(Schema.String)),
  deleted: Schema.optional(Schema.Boolean),
  parent: Schema.optional(
    Schema.NullOr(Schema.Struct({ id: Schema.Number }))
  ),
  inline: Schema.optional(
    Schema.NullOr(
      Schema.Struct({
        path: Schema.optional(Schema.String),
        from: Schema.optional(Schema.NullOr(Schema.Number)),
        to: Schema.optional(Schema.NullOr(Schema.Number))
      })
    )
  ),
  links: Schema.optional(Href)
})

const ActivityActor = Schema.Struct({
  user: Schema.optional(Author),
  date: Schema.optional(Schema.String)
})

export const Activity = Schema.Struct({
  pull_request: Schema.optional(
    Schema.Struct({
      id: Schema.optional(Schema.Number),
      title: Schema.optional(Schema.String)
    })
  ),
  comment: Schema.optional(Schema.NullOr(Comment)),
  approval: Schema.optional(Schema.NullOr(ActivityActor)),
  changes_requested: Schema.optional(Schema.NullOr(ActivityActor)),
  update: Schema.optional(
    Schema.NullOr(
      Schema.Struct({
        state: Schema.optional(Schema.String),
        title: Schema.optional(Schema.String),
        date: Schema.optional(Schema.String),
        author: Schema.optional(Author)
      })
    )
  )
})

export const Paged = <S extends Schema.Top>(value: S) =>
  Schema.Struct({
    values: Schema.optional(Schema.Array(value)),
    next: Schema.optional(Schema.String)
  })
