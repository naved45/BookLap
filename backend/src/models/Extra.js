// import mongoose from 'mongoose';
// const { Schema } = mongoose; const oid = (ref, extra = {}) => ({ type: Schema.Types.ObjectId, ref, ...extra });
// export const Order = mongoose.model('Order', new Schema({
//   buyerId: oid('User', { required: true, index: true }), sellerId: oid('User', { required: true, index: true }),
//   listingId: oid('Listing', { required: true }),
//   priceSnapshot: { title: String, author: String, price: Number, currency: String },
//   status: { type: String, enum: ['requested', 'ready', 'completed', 'cancelled'], default: 'requested' },
//   fulfilment: { type: String, enum: ['meetup', 'shipping'], default: 'meetup' },
//   paymentStatus: { type: String, enum: ['unpaid', 'paid'], default: 'unpaid' },
//   history: [{ status: String, by: oid('User'), at: { type: Date, default: Date.now } }],
// }, { timestamps: true }));
// const conv = new Schema({ participantIds: [oid('User')], listingId: oid('Listing'), lastMessageAt: { type: Date, default: Date.now } }, { timestamps: true });
// conv.index({ participantIds: 1, lastMessageAt: -1 });
// export const Conversation = mongoose.model('Conversation', conv);
// const msg = new Schema({ conversationId: oid('Conversation', { required: true }), senderId: oid('User', { required: true }), body: { type: String, required: true, maxlength: 1000 }, readBy: [oid('User')] }, { timestamps: true });
// msg.index({ conversationId: 1, createdAt: 1 });
// export const Message = mongoose.model('Message', msg);
// const note = new Schema({ userId: oid('User', { required: true }), type: String, text: { type: String, maxlength: 200 }, link: String, readAt: Date }, { timestamps: true });
// note.index({ userId: 1, readAt: 1, createdAt: -1 });
// export const Notification = mongoose.model('Notification', note);
// export const notify = (userId, type, text, link) => Notification.create({ userId, type, text, link }).catch((e) => console.error('[notify]', e));
// const rev = new Schema({ authorId: oid('User', { required: true }), targetUserId: oid('User', { required: true, index: true }), transactionType: { type: String, enum: ['swap', 'order'] }, transactionId: oid(null, { required: true }), rating: { type: Number, min: 1, max: 5, required: true }, comment: { type: String, maxlength: 500, default: '' } }, { timestamps: true });
// rev.index({ authorId: 1, transactionId: 1 }, { unique: true });
// export const Review = mongoose.model('Review', rev);
// export const Report = mongoose.model('Report', new Schema({
//   reporterId: oid('User', { required: true }), targetType: { type: String, enum: ['listing', 'user', 'post'], required: true }, targetId: oid(null, { required: true }),
//   reason: { type: String, required: true, maxlength: 500 }, status: { type: String, enum: ['open', 'resolved', 'dismissed'], default: 'open' }, resolution: { type: String, maxlength: 300 },
// }, { timestamps: true }));
// export const Community = mongoose.model('Community', new Schema({ name: { type: String, required: true, unique: true, trim: true, maxlength: 60 }, description: { type: String, maxlength: 300, default: '' }, ownerId: oid('User', { required: true }), members: [oid('User')] }, { timestamps: true }));
// export const Post = mongoose.model('Post', new Schema({ authorId: oid('User', { required: true }), communityId: oid('Community', { required: true, index: true }), body: { type: String, required: true, maxlength: 1000 }, status: { type: String, enum: ['active', 'removed'], default: 'active' } }, { timestamps: true }));
// export const AuditLog = mongoose.model('AuditLog', new Schema({ actorId: oid('User'), action: String, targetType: String, targetId: oid(null), meta: Object }, { timestamps: true }));
// const tok = new Schema({ userId: oid('User', { required: true }), kind: { type: String, enum: ['reset', 'verify'], required: true }, tokenHash: { type: String, required: true, index: true }, expiresAt: { type: Date, required: true }, usedAt: Date }, { timestamps: true });
// tok.index({ expiresAt: 1 }, { expireAfterSeconds: 86400 });
// export const Token = mongoose.model('Token', tok);
// export const Payment = mongoose.model('Payment', new Schema({
//   orderId: oid('Order', { required: true, index: true }), provider: { type: String, default: 'razorpay' }, providerOrderId: { type: String, index: true },
//   amount: Number, currency: String, status: { type: String, enum: ['created', 'paid', 'failed'], default: 'created' }, eventIds: [String],
// }, { timestamps: true }));

import mongoose from "mongoose";

const { Schema } = mongoose;

// Reusable ObjectId field helper
const oid = (ref, extra = {}) => ({
  type: Schema.Types.ObjectId,
  ...(ref ? { ref } : {}),
  ...extra,
});

// ==================== ORDER ====================

export const Order = mongoose.model(
  "Order",
  new Schema(
    {
      buyerId: oid("User", { required: true, index: true }),
      sellerId: oid("User", { required: true, index: true }),
      listingId: oid("Listing", { required: true }),

      priceSnapshot: {
        title: String,
        author: String,
        price: Number,
        currency: String,
      },

      status: {
        type: String,
        enum: ["requested", "ready", "completed", "cancelled"],
        default: "requested",
      },

      fulfilment: {
        type: String,
        enum: ["meetup", "shipping"],
        default: "meetup",
      },

      paymentStatus: {
        type: String,
        enum: ["unpaid", "paid"],
        default: "unpaid",
      },

      history: [
        {
          status: String,
          by: oid("User"),
          at: { type: Date, default: Date.now },
        },
      ],
    },
    { timestamps: true },
  ),
);

// ==================== CONVERSATION ====================

const conv = new Schema(
  {
    participantIds: [oid("User")],
    listingId: oid("Listing"),
    lastMessageAt: { type: Date, default: Date.now },
  },
  { timestamps: true },
);

conv.index({ participantIds: 1, lastMessageAt: -1 });

export const Conversation = mongoose.model("Conversation", conv);

// ==================== MESSAGE ====================

const msg = new Schema(
  {
    conversationId: oid("Conversation", { required: true }),
    senderId: oid("User", { required: true }),
    body: {
      type: String,
      required: true,
      maxlength: 1000,
    },
    readBy: [oid("User")],
  },
  { timestamps: true },
);

msg.index({ conversationId: 1, createdAt: 1 });

export const Message = mongoose.model("Message", msg);

// ==================== NOTIFICATION ====================

const note = new Schema(
  {
    userId: oid("User", { required: true }),
    type: String,
    text: { type: String, maxlength: 200 },
    link: String,
    readAt: Date,
  },
  { timestamps: true },
);

note.index({ userId: 1, readAt: 1, createdAt: -1 });

export const Notification = mongoose.model("Notification", note);

export const notify = (userId, type, text, link) =>
  Notification.create({ userId, type, text, link }).catch((error) => {
    console.error("[notify]", error);
  });

// ==================== REVIEW ====================

const rev = new Schema(
  {
    authorId: oid("User", { required: true }),

    targetUserId: oid("User", {
      required: true,
      index: true,
    }),

    transactionType: {
      type: String,
      enum: ["swap", "order"],
    },

    // Can refer to an order or a swap transaction.
    // No fixed ref because the target model varies.
    transactionId: {
      type: Schema.Types.ObjectId,
      required: true,
    },

    rating: {
      type: Number,
      min: 1,
      max: 5,
      required: true,
    },

    comment: {
      type: String,
      maxlength: 500,
      default: "",
    },
  },
  { timestamps: true },
);

rev.index({ authorId: 1, transactionId: 1 }, { unique: true });

export const Review = mongoose.model("Review", rev);

// ==================== REPORT ====================

export const Report = mongoose.model(
  "Report",
  new Schema(
    {
      reporterId: oid("User", { required: true }),

      targetType: {
        type: String,
        enum: ["listing", "user", "post"],
        required: true,
      },

      // Can refer to a listing, user, or post.
      targetId: {
        type: Schema.Types.ObjectId,
        required: true,
      },

      reason: {
        type: String,
        required: true,
        maxlength: 500,
      },

      status: {
        type: String,
        enum: ["open", "resolved", "dismissed"],
        default: "open",
      },

      resolution: {
        type: String,
        maxlength: 300,
      },
    },
    { timestamps: true },
  ),
);

// ==================== COMMUNITY ====================

export const Community = mongoose.model(
  "Community",
  new Schema(
    {
      name: {
        type: String,
        required: true,
        unique: true,
        trim: true,
        maxlength: 60,
      },

      description: {
        type: String,
        maxlength: 300,
        default: "",
      },

      ownerId: oid("User", { required: true }),
      members: [oid("User")],
    },
    { timestamps: true },
  ),
);

// ==================== POST ====================

export const Post = mongoose.model(
  "Post",
  new Schema(
    {
      authorId: oid("User", { required: true }),

      communityId: oid("Community", {
        required: true,
        index: true,
      }),

      body: {
        type: String,
        required: true,
        maxlength: 1000,
      },

      status: {
        type: String,
        enum: ["active", "removed"],
        default: "active",
      },
    },
    { timestamps: true },
  ),
);

// ==================== AUDIT LOG ====================

export const AuditLog = mongoose.model(
  "AuditLog",
  new Schema(
    {
      actorId: oid("User"),
      action: String,
      targetType: String,

      // Optional target ID; no fixed ref.
      targetId: {
        type: Schema.Types.ObjectId,
      },

      meta: Object,
    },
    { timestamps: true },
  ),
);

// ==================== TOKEN ====================

const tok = new Schema(
  {
    userId: oid("User", { required: true }),

    kind: {
      type: String,
      enum: ["reset", "verify"],
      required: true,
    },

    tokenHash: {
      type: String,
      required: true,
      index: true,
    },

    expiresAt: {
      type: Date,
      required: true,
    },

    usedAt: Date,
  },
  { timestamps: true },
);

tok.index({ expiresAt: 1 }, { expireAfterSeconds: 86400 });

export const Token = mongoose.model("Token", tok);

// ==================== PAYMENT ====================

export const Payment = mongoose.model(
  "Payment",
  new Schema(
    {
      orderId: oid("Order", {
        required: true,
        index: true,
      }),

      provider: {
        type: String,
        default: "razorpay",
      },

      providerOrderId: {
        type: String,
        index: true,
      },

      amount: Number,
      currency: String,

      status: {
        type: String,
        enum: ["created", "paid", "failed"],
        default: "created",
      },

      eventIds: [String],
    },
    { timestamps: true },
  ),
);
