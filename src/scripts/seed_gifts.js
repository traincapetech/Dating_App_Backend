import mongoose from 'mongoose';
import {config} from '../config/env.js';
import Gift from '../models/Gift.js';

const gifts = [
  {
    name: 'Rose',
    slug: 'rose',
    coinValue: 10,
    category: 'standard',
  },
  {
    name: 'Teddy Bear',
    slug: 'teddy-bear',
    coinValue: 25,
    category: 'standard',
  },
  {
    name: 'Ring',
    slug: 'ring',
    coinValue: 50,
    category: 'standard',
  },
  {
    name: 'Diamond',
    slug: 'diamond',
    coinValue: 75,
    category: 'premium',
  },
  {
    name: 'Crown',
    slug: 'crown',
    coinValue: 100,
    category: 'premium',
  },
];

const seedGifts = async () => {
  try {
    await mongoose.connect(config.mongoUri);
    console.log('Connected to MongoDB');

    for (const giftData of gifts) {
      await Gift.findOneAndUpdate({slug: giftData.slug}, giftData, {
        upsert: true,
        new: true,
      });
      console.log(`Seeded gift: ${giftData.name}`);
    }

    console.log('Gift seeding completed successfully');
    process.exit(0);
  } catch (error) {
    console.error('Error seeding gifts:', error);
    process.exit(1);
  }
};

seedGifts();
