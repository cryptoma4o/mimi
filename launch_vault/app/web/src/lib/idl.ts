import idlJson from "./idl/launch_vault.json";
import type { LaunchVault } from "./idl/launch_vault";

export const IDL = idlJson as unknown as LaunchVault;
export type { LaunchVault };
