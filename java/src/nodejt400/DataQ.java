package nodejt400;

import java.sql.Connection;
import com.ibm.as400.access.AS400;
import com.ibm.as400.access.AS400JDBCConnectionHandle;
import com.ibm.as400.access.DataQueue;

public class DataQ {

    private static final String EMPTY_STRING = "";
    private final ConnectionProvider connectionProvider;
    private final String path;

    public DataQ(ConnectionProvider connectionProvider, String path) {
        this.connectionProvider = connectionProvider;
        this.path = path;
    }

    private DataQueue getDataQueue() throws Exception {
        AS400 as400 = connectionProvider.getAS400Connection();
        DataQueue dq = new DataQueue(as400, path);

        return dq;
    }

    public String peek() throws Exception {
        String response = EMPTY_STRING;

        try {
            DataQueue dq = getDataQueue();
            response = dq.peek().getString();
        } catch (Exception ex) {
            throw ex;
        } finally {
            connectionProvider.close();
        }

        return response;
    }

    public String peek(int wait) throws Exception {
        String response = EMPTY_STRING;

        try {
            DataQueue dq = getDataQueue();
            response = dq.peek(wait).getString();
        } catch (Exception ex) {
            throw ex;
        } finally {
            connectionProvider.close();
        }

        return response;
    }

    public String read() throws Exception {
        String response = EMPTY_STRING;

        try {
            DataQueue dq = getDataQueue();
            response = dq.read().getString();
        } catch (Exception ex) {
            throw ex;
        } finally {
            connectionProvider.close();
        }

        return response;
    }

    public String read(int wait) throws Exception {
        String response = EMPTY_STRING;

        try {
            DataQueue dq = getDataQueue();
            response = dq.read(wait).getString();
        } catch (Exception ex) {
            throw ex;
        } finally {
            connectionProvider.close();
        }

        return response;
    }

    public DataQResponse readResponse(int wait) throws Exception {
        String data = read(wait);
        return new DataQResponse(data, this);
    }

    public void write(String data) throws Exception {
        Connection c = connectionProvider.getConnection();

        try {
            DataQueue dq = getDataQueue();
            dq.write(data);
        } catch (Exception ex) {
            throw ex;
        } finally {
            connectionProvider.close();
        }
    }
}