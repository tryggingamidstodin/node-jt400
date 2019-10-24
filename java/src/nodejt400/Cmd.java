package nodejt400;

import java.sql.Connection;

import com.ibm.as400.access.AS400;
import com.ibm.as400.access.AS400JDBCConnectionHandle;
import com.ibm.as400.access.AS400Message;
import com.ibm.as400.access.CommandCall;

import org.json.simple.JSONObject;

public class Cmd
{
  private final ConnectionProvider connectionProvider;

  private final String cmdString;

  public Cmd(ConnectionProvider connectionProvider, String cmdString)
  {
    this.connectionProvider = connectionProvider;
    this.cmdString = cmdString;
  }

  public String run(String cmdString) throws Exception
  {
    Connection c = connectionProvider.getConnection();
    JSONObject result = new JSONObject();
        
    try
    {
      AS400JDBCConnectionHandle handle = (AS400JDBCConnectionHandle) c;
      AS400 as400 = handle.getSystem();
      
      CommandCall call = new CommandCall(as400);
      
      //Run
      call.setCommand(cmdString);
      if (call.run() != true)
      {
        AS400Message[] ms = call.getMessageList();
        StringBuffer error = new StringBuffer();
        error.append("Command ");
        error.append(call.getCommand());
        error.append(" did not run: " );
        for (int i = 0; i < ms.length; i++)
        {
          error.append(ms[i].toString());
          error.append("\n");
        }
        throw new Exception(error.toString());
        //System.out.println("Command failed!");
      }

      AS400Message[] messagelist = call.getMessageList();
      for (int i = 0; i < messagelist.length; ++i)
      {
        // Show each message.
        result.put(String.valueOf(i), messagelist[i].getText());
      }

    }
    catch (Exception ex)
    {
      throw ex;
    }
    finally
    {
      connectionProvider.returnConnection(c);
    }

    return result.toJSONString();

  }
}