package payment_system_backend.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.SerializationFeature;
import com.fasterxml.jackson.datatype.jsr310.JavaTimeModule;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import payment_system_backend.model.BankAccount;
import payment_system_backend.model.Transaction;
import payment_system_backend.model.User;
import payment_system_backend.repository.BankAccountRepository;
import payment_system_backend.repository.TransactionRepository;
import payment_system_backend.repository.UserRepository;

import java.time.LocalDateTime;
import java.util.*;

@Service
  public class DataBackupService {

    @Autowired
        private UserRepository userRepository;

    @Autowired
        private TransactionRepository transactionRepository;

    @Autowired
        private BankAccountRepository bankAccountRepository;

    private final ObjectMapper objectMapper;

    public DataBackupService() {
              this.objectMapper = new ObjectMapper();
              this.objectMapper.registerModule(new JavaTimeModule());
              this.objectMapper.disable(SerializationFeature.WRITE_DATES_AS_TIMESTAMPS);
              this.objectMapper.enable(SerializationFeature.INDENT_OUTPUT);
    }

    public Map<String, Object> exportFullBackup() {
              List<User> users = userRepository.findAll();
              List<Transaction> transactions = transactionRepository.findAll();
              List<BankAccount> bankAccounts = bankAccountRepository.findAll();

            Map<String, Object> backup = new LinkedHashMap<>();
              Map<String, Object> metadata = new LinkedHashMap<>();
              metadata.put("version", "1.0");
              metadata.put("exportedAt", LocalDateTime.now().toString());
              metadata.put("totalUsers", users.size());
              metadata.put("totalTransactions", transactions.size());
              metadata.put("totalBankAccounts", bankAccounts.size());
              backup.put("_metadata", metadata);
              backup.put("users", users);
              backup.put("transactions", transactions);
              backup.put("bankAccounts", bankAccounts);
              return backup;
    }

    @Transactional
        @SuppressWarnings("unchecked")
        public Map<String, Object> restoreFromBackup(Map<String, Object> backupData) {
                  int usersRestored = 0;
                  int transactionsRestored = 0;
                  int bankAccountsRestored = 0;
                  List<String> errors = new ArrayList<>();

            List<Map<String, Object>> usersData = (List<Map<String, Object>>) backupData.get("users");
                  if (usersData != null) {
                                for (Map<String, Object> userData : usersData) {
                                                  try {
                                                                        User user = objectMapper.convertValue(userData, User.class);
                                                                        if (userData.containsKey("transactionPin")) {
                                                                                                  user.setTransactionPin((String) userData.get("transactionPin"));
                                                                        }
                                                                        userRepository.save(user);
                                                                        usersRestored++;
                                                  } catch (Exception e) {
                                                                        errors.add("User ID " + userData.get("id") + ": " + e.getMessage());
                                                  }
                                }
                  }

            List<Map<String, Object>> bankData = (List<Map<String, Object>>) backupData.get("bankAccounts");
                  if (bankData != null) {
                                for (Map<String, Object> bankEntry : bankData) {
                                                  try {
                                                                        BankAccount account = objectMapper.convertValue(bankEntry, BankAccount.class);
                                                                        bankAccountRepository.save(account);
                                                                        bankAccountsRestored++;
                                                  } catch (Exception e) {
                                                                        errors.add("BankAccount ID " + bankEntry.get("id") + ": " + e.getMessage());
                                                  }
                                }
                  }

            List<Map<String, Object>> txData = (List<Map<String, Object>>) backupData.get("transactions");
                  if (txData != null) {
                                for (Map<String, Object> txEntry : txData) {
                                                  try {
                                                                        Transaction tx = objectMapper.convertValue(txEntry, Transaction.class);
                                                                        transactionRepository.save(tx);
                                                                        transactionsRestored++;
                                                  } catch (Exception e) {
                                                                        errors.add("Transaction ID " + txEntry.get("id") + ": " + e.getMessage());
                                                  }
                                }
                  }

            Map<String, Object> result = new LinkedHashMap<>();
                  result.put("status", errors.isEmpty() ? "SUCCESS" : "PARTIAL");
                  result.put("restoredAt", LocalDateTime.now().toString());
                  result.put("usersRestored", usersRestored);
                  result.put("bankAccountsRestored", bankAccountsRestored);
                  result.put("transactionsRestored", transactionsRestored);
                  result.put("totalRestored", usersRestored + bankAccountsRestored + transactionsRestored);
                  if (!errors.isEmpty()) {
                                result.put("errors", errors);
                  }
                  return result;
        }

    public Map<String, Object> getBackupStats() {
              Map<String, Object> stats = new LinkedHashMap<>();
              stats.put("totalUsers", userRepository.count());
              stats.put("totalTransactions", transactionRepository.count());
              stats.put("totalBankAccounts", bankAccountRepository.count());
              stats.put("checkedAt", LocalDateTime.now().toString());
              return stats;
    }
  }
