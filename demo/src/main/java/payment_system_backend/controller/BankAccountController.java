package payment_system_backend.controller;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import payment_system_backend.model.BankAccount;
import payment_system_backend.repository.BankAccountRepository;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/bank")
public class BankAccountController {

    @Autowired
    private BankAccountRepository bankAccountRepository;

    /** GET /bank/accounts/{userId} — list all bank accounts for user */
    @GetMapping("/accounts/{userId}")
    public ResponseEntity<List<BankAccount>> getAccounts(@PathVariable Long userId) {
        return ResponseEntity.ok(bankAccountRepository.findByUserId(userId));
    }

    /** POST /bank/add — add a new bank account */
    @PostMapping("/add")
    public ResponseEntity<?> addAccount(@RequestBody Map<String, Object> body) {
        Long userId = Long.valueOf(body.get("userId").toString());
        String accountNumberFull = body.get("accountNumber").toString().replaceAll("\\s+", "");
        String holderName = body.get("accountHolderName").toString();
        String ifsc = body.get("ifscCode").toString().toUpperCase();
        String bankName = body.get("bankName").toString();
        String accountType = body.getOrDefault("accountType", "SAVINGS").toString();

        // Basic validations
        if (accountNumberFull.length() < 9 || accountNumberFull.length() > 18) {
            return ResponseEntity.badRequest().body("Account number must be 9-18 digits.");
        }
        if (!ifsc.matches("^[A-Z]{4}0[A-Z0-9]{6}$")) {
            return ResponseEntity.badRequest().body("Invalid IFSC code format.");
        }
        if (bankAccountRepository.existsByAccountNumberFull(accountNumberFull)) {
            return ResponseEntity.badRequest().body("This account number is already linked.");
        }

        // Mask: show only last 4 digits
        String masked = "XXXX XXXX " + accountNumberFull.substring(accountNumberFull.length() - 4);

        // If first account, set as primary
        List<BankAccount> existing = bankAccountRepository.findByUserId(userId);
        boolean isPrimary = existing.isEmpty();

        BankAccount account = new BankAccount();
        account.setUserId(userId);
        account.setAccountHolderName(holderName);
        account.setAccountNumber(masked);
        account.setAccountNumberFull(accountNumberFull);
        account.setIfscCode(ifsc);
        account.setBankName(bankName);
        account.setAccountType(accountType);
        account.setPrimary(isPrimary);

        BankAccount saved = bankAccountRepository.save(account);

        Map<String, Object> res = new HashMap<>();
        res.put("success", true);
        res.put("account", saved);
        res.put("message", "Bank account added successfully!");
        return ResponseEntity.ok(res);
    }

    /** DELETE /bank/remove/{accountId} — remove a bank account */
    @DeleteMapping("/remove/{accountId}")
    public ResponseEntity<?> removeAccount(@PathVariable Long accountId) {
        if (!bankAccountRepository.existsById(accountId)) {
            return ResponseEntity.notFound().build();
        }
        bankAccountRepository.deleteById(accountId);
        return ResponseEntity.ok(Map.of("success", true, "message", "Account removed."));
    }

    /** PUT /bank/primary/{userId}/{accountId} — set account as primary */
    @PutMapping("/primary/{userId}/{accountId}")
    public ResponseEntity<?> setPrimary(@PathVariable Long userId, @PathVariable Long accountId) {
        List<BankAccount> accounts = bankAccountRepository.findByUserId(userId);
        accounts.forEach(a -> {
            a.setPrimary(a.getId().equals(accountId));
            bankAccountRepository.save(a);
        });
        return ResponseEntity.ok(Map.of("success", true, "message", "Primary account updated."));
    }
}
