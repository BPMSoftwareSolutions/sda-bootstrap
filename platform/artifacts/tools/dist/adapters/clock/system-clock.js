export class SystemClock {
    now() {
        return new Date().toISOString();
    }
}
