import mongoose from 'mongoose';

/** Atlas + PaaS: longer selection timeout; family 4 avoids rare IPv6/DNS issues from cloud egress. */
const connectOptions = {
  serverSelectionTimeoutMS: 30000,
  family: 4,
};

export async function connectDB(uri) {
  mongoose.set('strictQuery', true);
  await mongoose.connect(uri, connectOptions);
  console.log('MongoDB connected');
}
