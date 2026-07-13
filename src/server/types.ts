import type { KeplerHabitatState } from "../kepler/types";

export type RegistrationResource = {
  registration: {
    habitatUuid: string;
    habitatId: string;
    displayName: string;
    apiToken: string | null;
  } | null;
};

export type RegistrationStateResource = {
  registration: KeplerHabitatState;
};

export type UnregisterResource = RegistrationStateResource & {
  remoteHabitatDeleted: boolean;
};
