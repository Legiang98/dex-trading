import Joi from "joi";

export const webhookSchema = Joi.object({
  symbol: Joi.string().required(),
  action: Joi.string()
    .uppercase()
    .valid("ENTRY", "EXIT", "UPDATE_STOP")
    .required(),
  type: Joi.string()
    .uppercase()
    .valid("BUY", "SELL")
    .required(),
  price: Joi.number().required(),
  stopLoss: Joi.number().optional(),
  strategy: Joi.string().optional(),
  orderId: Joi.string().optional(),
});
