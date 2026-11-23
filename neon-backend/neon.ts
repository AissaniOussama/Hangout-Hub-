import { defineConfig } from "@neon/config/v1";

export default defineConfig({
  // Declare your Neon services here
  auth: false,
  functions: {
    hangouthub: { name: "hangouthub", source: "src/index.ts" },
  },
  triggers: {
    // taegliche Mitbringlisten-Erinnerung (08:00 UTC = 09:00 Winterzeit Berlin)
    "hangouthub-bring-reminder": {
      type: "schedule",
      function: "hangouthub",
      cron: "0 8 * * *",
      functionPath: "/internal/cron/bring-reminder",
    },
  },
  // Branch policy: per-branch tuning
  branch: (branch) => {
    if (branch.isDefault) {
      // Default branch: no overrides, uses project defaults
      return {};
    }
    if (!branch.exists) {
      // New non-default branches: auto-expire
      // Run `neon checkout <name>` to create a new branch with these settings
      return { ttl: "7d" };
    }
    // Existing branch: no changes
    return {};
  },
});
