import {EventEmitter} from 'events';

class StreakEventEmitter extends EventEmitter {
  constructor() {
    super();
    this.on('activity:engagement', data => {
      console.log(
        `[Streak] Activity: Engagement event for ${data.fromUser} -> ${data.toUser} (${data.type})`,
      );
    });
  }
}

const eventEmitter = new StreakEventEmitter();
export default eventEmitter;
