package com.horhge.sql.service;

import javax.crypto.Cipher;
import javax.crypto.spec.IvParameterSpec;
import javax.crypto.spec.SecretKeySpec;
import java.util.Base64;

public class AesEncryptionUtil {
    // For demo/dev: use a static key and IV. In production, use a secure key management system.
    private static final String SECRET_KEY_BASE64 = "seLzpMXW5/ipsMHQ4/SltsfY6fChssPU5fanuMnQ4fI="; // 32 bytes, Base64
    private static final String INIT_VECTOR_BASE64 = "Gis8TV5veoucDR4vOktcbQ=="; // 16 bytes, Base64

    public static String encrypt(String value) throws Exception {
        byte[] ivBytes = Base64.getDecoder().decode(INIT_VECTOR_BASE64);
        byte[] keyBytes = Base64.getDecoder().decode(SECRET_KEY_BASE64);
        IvParameterSpec iv = new IvParameterSpec(ivBytes);
        SecretKeySpec skeySpec = new SecretKeySpec(keyBytes, "AES");

        Cipher cipher = Cipher.getInstance("AES/CBC/PKCS5PADDING");
        cipher.init(Cipher.ENCRYPT_MODE, skeySpec, iv);

        byte[] encrypted = cipher.doFinal(value.getBytes());
        return Base64.getEncoder().encodeToString(encrypted);
    }

    public static String decrypt(String encrypted) throws Exception {
        byte[] ivBytes = Base64.getDecoder().decode(INIT_VECTOR_BASE64);
        byte[] keyBytes = Base64.getDecoder().decode(SECRET_KEY_BASE64);
        IvParameterSpec iv = new IvParameterSpec(ivBytes);
        SecretKeySpec skeySpec = new SecretKeySpec(keyBytes, "AES");

        Cipher cipher = Cipher.getInstance("AES/CBC/PKCS5PADDING");
        cipher.init(Cipher.DECRYPT_MODE, skeySpec, iv);
        byte[] original = cipher.doFinal(Base64.getDecoder().decode(encrypted));

        return new String(original);
    }
}
