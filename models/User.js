const mongoose = require("mongoose");
const { Schema } = mongoose;

// Account schema
const accountSchema = new mongoose.Schema({
  accountId: { type: mongoose.Types.ObjectId, required: true },
  accountNumber: { type: String, required: true },
  type: { type: String, required: true },
  balance: { type: Number, default: 0 },
  currency: { type: String, required: true },
  transactions: [
    {
      transactionId: { type: mongoose.Types.ObjectId, required: true },
      date: { type: Date, required: true },
      type: { type: String, required: true },
      amount: { type: Number, required: true },
      currency: { type: String, required: true },
      description: { type: String, required: true },
    },
  ],
});

// Withdrawal schema with stages
const withdrawalSchema = new mongoose.Schema({
  withdrawalId: {
    type: mongoose.Types.ObjectId,
    required: true,
    default: () => new mongoose.Types.ObjectId(),
  },
  accountId: { type: mongoose.Types.ObjectId, required: true },
  accountNumber: { type: String, required: true },
  amount: { type: Number, required: true },
  currency: { type: String, required: true },
  date: { type: Date, default: Date.now },
  status: {
    type: String,
    enum: ["pending", "completed", "failed"],
    default: "pending",
  },
  stages: [
    {
      name: { type: String, enum: ["stage1", "stage2", "stage3", "stage4", "stage5", "stage6", "stage7", "stage8", "stage9", "stage10"], required: true },
      completed: { type: Boolean, default: false }
    }
  ],
  currentStage: { type: String, default: "stage1" },
  description: { type: String },
});

// Loan schema
// Loan schema
const loanSchema = new Schema({
  loanId: { type: mongoose.Schema.Types.ObjectId, required: true, default: () => new mongoose.Types.ObjectId() },
  accountId: { type: mongoose.Schema.Types.ObjectId, required: true },
  loanAmount: { type: Number, required: true },
  currency: { type: String, required: true },
  interestRate: { type: Number, required: true }, // in percentage
  termLength: { type: Number, required: true }, // in months or years
  status: { type: String, enum: ["pending", "active", "repaid", "defaulted"], default: "pending" },
  startDate: { type: Date, default: Date.now },
  endDate: { type: Date },
  repayments: [{ type: Schema.Types.ObjectId, ref: "LoanRepayment" }],
});

// Loan repayment schema
const loanRepaymentSchema = new Schema({
  repaymentId: { type: Schema.Types.ObjectId, required: true, default: () => new mongoose.Types.ObjectId() }, // Correct usage
  loanId: { type: Schema.Types.ObjectId, required: true },
  accountId: { type: Schema.Types.ObjectId, required: true },
  repaymentAmount: { type: Number, required: true },
  currency: { type: String, required: true },
  date: { type: Date, default: Date.now },
  status: { type: String, enum: ["pending", "completed", "failed"], default: "pending" },
});

// User schema
const userSchema = new mongoose.Schema({
  firstName: { type: String, required: true },
  middleName: { type: String },
  lastName: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  phoneNumber: { type: String, required: true },
  gender: { type: String, required: true },
  dateOfBirth: { type: Date, required: true },
  accountType: { type: String, required: true },
  address: { type: String, required: true },
  postalCode: { type: String, required: true },
  state: { type: String, required: true },
  country: { type: String, required: true },
  currency: { type: String, required: true },
  password: { type: String, required: true },
  accountPin: { type: String, required: true },
  agree: { type: Boolean, default: true, required: true },
  kycStatus: { type: String, default: "pending" },
  balance: { type: Number, default: 0 },
  accounts: [accountSchema],
  withdrawals: [withdrawalSchema],
  loans: [loanSchema],
  loanRepayments: [loanRepaymentSchema],
  notifications: [
    {
      notificationId: { type: mongoose.Types.ObjectId, default: () => new mongoose.Types.ObjectId() },
      message: { type: String, required: true },
      date: { type: Date, default: Date.now },
      read: { type: Boolean, default: false }
    }
  ],
  dateOfAccountCreation: { type: Date, default: Date.now },
  passwordResetToken: String,
  passwordResetExpires: Date,
  otp: { type: String },
  otpExpires: { type: Date },
});

module.exports = mongoose.model("User", userSchema);
