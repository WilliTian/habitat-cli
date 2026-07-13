export type RegistrationResource = {
  registration: {
    habitatUuid: string;
    habitatId: string;
    displayName: string;
    apiToken: string | null;
  } | null;
};
