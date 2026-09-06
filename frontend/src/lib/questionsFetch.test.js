import { classifyQuestionsError } from "./questionsFetch";

test("402 free-tier gate carries through the structured detail", () => {
  const err = {
    response: {
      status: 402,
      data: { detail: { rounds_played_today: 3, free_rounds_per_day: 3, message: "done for today" } },
    },
  };
  const result = classifyQuestionsError(err);
  expect(result).toEqual({
    type: "free_tier_gate",
    rounds_played_today: 3,
    free_rounds_per_day: 3,
    message: "done for today",
  });
});

test("no response at all (timeout/offline/ATS block) is a retryable network_error, not a blank screen", () => {
  const err = { message: "timeout of 20000ms exceeded", code: "ECONNABORTED" };
  expect(classifyQuestionsError(err).type).toBe("network_error");
});

test("401 is a retryable auth_error, not the free-tier gate", () => {
  const err = { response: { status: 401, data: {} } };
  expect(classifyQuestionsError(err).type).toBe("auth_error");
});

test("5xx is a retryable server_error", () => {
  const err = { response: { status: 500, data: {} } };
  expect(classifyQuestionsError(err).type).toBe("server_error");
});
