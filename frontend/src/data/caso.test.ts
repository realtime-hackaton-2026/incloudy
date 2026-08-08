import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  pickEventForTrigger,
  getVocesHipotesis,
  getHipotesisRespaldada,
  HIPOTESIS_VOCES,
} from "./caso";

describe("pickEventForTrigger", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("no repite un evento ya disparado", () => {
    const result = pickEventForTrigger("actuar", ["reunion-familia"]);
    expect(result).toBeNull();
  });

  it("respeta la probabilidad del evento cuando no es la última oportunidad", () => {
    vi.spyOn(Math, "random").mockReturnValue(0.9); // por encima de chance: 0.5
    const result = pickEventForTrigger("actuar", []);
    expect(result).toBeNull();
  });

  it("dispara el evento cuando la tirada cae dentro de su probabilidad", () => {
    vi.spyOn(Math, "random").mockReturnValue(0.1); // por debajo de chance: 0.5
    const result = pickEventForTrigger("actuar", []);
    expect(result?.id).toBe("reunion-familia");
  });

  it("garantiza al menos un evento por partida en la última oportunidad", () => {
    vi.spyOn(Math, "random").mockReturnValue(0.99); // tirada que normalmente fallaría
    const result = pickEventForTrigger("acompanar", []);
    expect(result?.id).toBe("mal-dia");
  });

  it("no fuerza el evento en la última oportunidad si ya saltó uno antes", () => {
    vi.spyOn(Math, "random").mockReturnValue(0.99);
    const result = pickEventForTrigger("acompanar", ["reunion-familia"]);
    expect(result).toBeNull();
  });
});

describe("getVocesHipotesis", () => {
  it("usa el tono neutro cuando no hay hipótesis respaldada", () => {
    const voces = getVocesHipotesis("reto", null);
    expect(voces).toEqual(HIPOTESIS_VOCES.reto.base);
  });

  it("usa el tono reforzado cuando la hipótesis coincide con la respaldada", () => {
    const voces = getVocesHipotesis("reto", "reto");
    expect(voces).toEqual(HIPOTESIS_VOCES.reto.reforzada);
  });

  it("usa el tono debilitado cuando otra hipótesis queda respaldada", () => {
    const voces = getVocesHipotesis("reto", "vinculo");
    expect(voces).toEqual(HIPOTESIS_VOCES.reto.debilitada);
  });

  it("devuelve null para una hipótesis inexistente", () => {
    expect(getVocesHipotesis("inexistente", null)).toBeNull();
  });
});

describe("getHipotesisRespaldada", () => {
  it("no respalda ninguna hipótesis con menos de dos pistas de Explorar", () => {
    const pistas = [{ id: "explorar-voz", mission: "explorar" }];
    expect(getHipotesisRespaldada(pistas)).toBeNull();
  });

  it("respalda la hipótesis con más votos entre las pistas de Explorar", () => {
    const pistas = [
      { id: "explorar-voz", mission: "explorar" },
      { id: "explorar-observacion", mission: "explorar" },
      { id: "explorar-produccion", mission: "explorar" },
      { id: "explorar-produccion", mission: "explorar" },
    ];
    expect(getHipotesisRespaldada(pistas)).toBe("autonomia");
  });

  it("no respalda ninguna en caso de empate", () => {
    const pistas = [
      { id: "explorar-voz", mission: "explorar" },
      { id: "explorar-observacion", mission: "explorar" },
    ];
    expect(getHipotesisRespaldada(pistas)).toBeNull();
  });
});
