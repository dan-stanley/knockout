import { type ClientSchema, a, defineData } from "@aws-amplify/backend";

const schema = a.schema({
  Entry: a.model({
    ownerId: a.string(),
    entryName: a.string(),
    isAlive: a.boolean(),
    buybacksUsed: a.integer(),
    usedTeams: a.string().array(),

    // Picks for all days (Stringified JSON: Record<string, string[]>)
    picksData: a.string(),
  }).authorization(allow => [
    allow.ownerDefinedIn('ownerId').identityClaim('email'),
    allow.authenticated(),
  ])
});

export type Schema = ClientSchema<typeof schema>;

export const data = defineData({
  schema,
  authorizationModes: {
    defaultAuthorizationMode: "userPool",
  },
});
