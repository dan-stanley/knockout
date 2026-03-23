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
    allow.owner(),
    allow.authenticated().to(['read']),
  ]),

  GameResult: a.model({
    teamName: a.string(),
    hasWon: a.boolean(),
    hasLost: a.boolean(),
    status: a.string(),
  }).authorization(allow => [allow.authenticated()]),
});

export type Schema = ClientSchema<typeof schema>;

export const data = defineData({
  schema,
  authorizationModes: {
    defaultAuthorizationMode: "userPool",
  },
});
