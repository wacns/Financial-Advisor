export function sharedAccountService(client) {
  return {
    async call(action, values = {}) {
      if (!client) throw Error("Sign in to use shared accounts.");
      const { data, error } = await client.rpc("fa_shared", {
        p_action: action,
        p_data: values,
      });
      if (error)
        throw Error(
          error.code === "40001"
            ? "Someone changed this record. Refresh and review it before trying again."
            : error.message || "Unable to update the shared account.",
        );
      return data;
    },
  };
}
