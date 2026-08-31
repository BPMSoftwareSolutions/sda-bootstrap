import type { ClockPort } from "../../ports/infrastructure-ports.js";
export declare class SystemClock implements ClockPort {
    now(): string;
}
