import {createClient} from '@sanity/client';

export const client = createClient({
  projectId: 'y34pgcbk',
  dataset: 'production',
  useCdn: false, // set to `false` to bypass the edge cache
  apiVersion: '2025-04-29', // use current date (YYYY-MM-DD) to target the latest API version. Note: this should always be hard coded. Setting API version based on a dynamic value (e.g. new Date()) may break your application at a random point in the future.
  token: process.env.SANITY_API_KEY // Needed for certain operations like updating content, accessing drafts or using draft perspectives
});

