package payment_system_backend.service;

import jakarta.transaction.Transactional;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import payment_system_backend.model.Transaction;
import payment_system_backend.model.User;
import payment_system_backend.repository.TransactionRepository;
import payment_system_backend.repository.UserRepository;

import java.time.LocalDateTime;

@Service
public class TransactionService {

    @Autowired
    private TransactionRepository transactionRepo;

    @Autowired
    private UserRepository userRepository;

    @Transactional
    public void sendMoney(Long senderId, Long receiverId, double amount){

        User sender = userRepository.findById(senderId).orElseThrow();
        User receiver = userRepository.findById(receiverId).orElseThrow();

        if(amount > 50000){
            throw new RuntimeException("Fraud detected: amount too large");
        }

//        if(sender.getAccountAgeDays() < 7 && amount > 10000){
//            throw new RuntimeException("Fraud detected: new account large transfer");
//        }

        if(sender.getBalance() < amount){
            throw new RuntimeException("Insufficient balance");
        }

        sender.setBalance(sender.getBalance() - amount);
        receiver.setBalance(receiver.getBalance() + amount);

        userRepository.save(sender);
        userRepository.save(receiver);

        Transaction tx = new Transaction();
        tx.setSenderId(senderId);
        tx.setReceiverId(receiverId);
        tx.setAmount(amount);
        tx.setStatus("SUCCESS");
        tx.setTime(LocalDateTime.now());

        transactionRepo.save(tx);
    }

    public void retryTransaction(Long transactionId){

        Transaction tx = transactionRepo.findById(transactionId).orElseThrow();

        if(tx.getStatus().equals("FAILED")){
            sendMoney(tx.getSenderId(), tx.getReceiverId(), tx.getAmount());
        }
    }
}