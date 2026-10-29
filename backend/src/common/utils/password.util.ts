import * as argon2 from 'argon2';

/** Tham số theo khuyến nghị OWASP cho Argon2id. */
const OPTIONS: argon2.Options = {
  type: argon2.argon2id,
  memoryCost: 19456, // 19 MiB
  timeCost: 2,
  parallelism: 1,
};

export const hashSecret = (plain: string) => argon2.hash(plain, OPTIONS);

export const verifySecret = async (hash: string, plain: string): Promise<boolean> => {
  try {
    return await argon2.verify(hash, plain);
  } catch {
    return false;
  }
};
