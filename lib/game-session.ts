type GameResponse<T> = { data: T | null; error: { message: string } | null };

/** Invalidates in-flight work immediately, before React commits an account change. */
export class GameSessionGate {
  private generation = 0;
  private identity = "unknown";

  capture() {
    return this.generation;
  }
  isCurrent(ticket: number) {
    return ticket === this.generation;
  }
  isAccount(id: string) {
    return this.identity === `user:${id}`;
  }
  isDemo() {
    return this.identity === "demo";
  }

  enterAccount(id: string) {
    if (!this.isAccount(id)) {
      this.identity = `user:${id}`;
      this.generation++;
    }
    return this.generation;
  }
  enterSignedOut() {
    this.identity = "signed-out";
    return ++this.generation;
  }
  enterDemo() {
    this.identity = "demo";
    return ++this.generation;
  }

  async load<T extends { id: string }>(
    ticket: number,
    userId: string,
    request: () => PromiseLike<GameResponse<T>>,
  ): Promise<
    | { status: "stale" | "identity-mismatch" }
    | { status: "loaded"; data: T | null }
    | { status: "error"; error: { message: string } }
  > {
    if (!this.isCurrent(ticket) || !this.isAccount(userId))
      return { status: "stale" };
    try {
      const response = await request();
      if (!this.isCurrent(ticket) || !this.isAccount(userId))
        return { status: "stale" };
      if (response.error) return { status: "error", error: response.error };
      if (response.data && response.data.id !== userId)
        return { status: "identity-mismatch" };
      return { status: "loaded", data: response.data };
    } catch (error) {
      if (!this.isCurrent(ticket)) return { status: "stale" };
      throw error;
    }
  }
}
