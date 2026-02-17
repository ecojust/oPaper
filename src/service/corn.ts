import { IntervalBasedCronScheduler } from "cron-schedule/schedulers/interval-based.js";
import { parseCronExpression } from "cron-schedule";
export class IntervalCorn {
  private scheduler: IntervalBasedCronScheduler;

  constructor(triggerCallback: Function, interval: number = 5) {
    this.scheduler = new IntervalBasedCronScheduler(1000);
    const cron = parseCronExpression(`*/${interval} * * * * *`);
    this.scheduler.registerTask(
      cron,
      () => {
        typeof triggerCallback === "function" && triggerCallback();
      },
      { isOneTimeTask: false },
    );
  }

  public start() {
    this.scheduler.start();
  }

  public stop() {
    this.scheduler.stop();
  }
}
