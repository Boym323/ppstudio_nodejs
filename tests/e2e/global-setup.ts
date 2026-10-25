import { assertE2eDatabaseIdentity } from "./helpers/database-safety";

export default async function globalSetup() {
  const identity = await assertE2eDatabaseIdentity();
  console.info(
    `E2E DB ověřena: ${identity.serverAddress ?? "local socket"}:${identity.serverPort ?? "n/a"}/${identity.database}/${identity.schema}`,
  );
}
